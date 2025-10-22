import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { spawn } from "child_process";
import youtubedl from "youtube-dl-exec"; // ⬅️ use yt-dlp via wrapper

const pump = promisify(pipeline);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

/* -------------------------------------------------------------------------- */
/*                                  MAIN POST                                 */
/* -------------------------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const urlHeader = req.headers.get("x-url");
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");
    const folderHeader = req.headers.get("x-folder");

    const uploadDir = path.resolve("/shared-files");
    await fs.promises.mkdir(uploadDir, { recursive: true });

    /* ---------------------------------------------------------------------- */
    /*                       CASE 1: YouTube URL DOWNLOAD                     */
    /* ---------------------------------------------------------------------- */
    if (urlHeader) {
      const url = decodeURIComponent(urlHeader.trim());
      const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

      // Sanitize title via yt-dlp output template; also restrict filenames
      // Use mp4 container; prefer best video+audio (DASH) with fallback to best single stream
      // Disable playlists for single-link behavior
      const outTemplate = path.join(uploadDir, "%(title).200s.%(ext)s");

      // Public-safe defaults (no personal cookies)
      const baseOpts: Record<string, any> = {
        output: outTemplate,
        // prefer split best video + best audio, fallback to best single stream
        format: "bv*+ba/b",
        "merge-output-format": "mp4",
        "no-playlist": true,
        "restrict-filenames": true,
        // Make requests look like a normal browser
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "add-header": ["Accept-Language: en-US,en;q=0.9"],
        // safer network defaults
        // "limit-rate": "2M",           // (optional) avoid aggressive throttling
        // "concurrent-fragments": 5,    // (optional) HLS/DASH
        // "retries": 5, "fragment-retries": 10
      };

      // Optional: if you ever want to enable browser cookies (still public-safe if you use
      // a throwaway profile on the server). Keep OFF by default.
      if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
        baseOpts["cookies-from-browser"] = process.env.YTDLP_COOKIES_FROM_BROWSER; // e.g. "chrome" or "firefox"
      }
      if (process.env.YTDLP_COOKIES_FILE) {
        baseOpts["cookies"] = process.env.YTDLP_COOKIES_FILE; // e.g. "/app/cookies.txt"
      }

      let result;
      try {
        // Run yt-dlp. It will download, pick formats, and merge via ffmpeg automatically.
        result = await youtubedl(url, baseOpts);
        console.log("yt-dlp finished:", result);
      } catch (e: any) {
        console.error("❌ yt-dlp failed:", e?.stderr || e?.message || e);
        return NextResponse.json(
          {
            error:
              "Download failed. The video may be age/region restricted or blocked. " +
              "This server supports public videos without login.",
          },
          { status: 502 }
        );
      }

      // Resolve the actual output file path: yt-dlp uses the template to write the file.
      // Find the .mp4 recently written in uploadDir by checking mtime.
      const file = await pickMostRecentFile(uploadDir, ".mp4");
      if (!file) {
        return NextResponse.json(
          { error: "Download completed but output file was not found." },
          { status: 500 }
        );
      }

      const stats = await fs.promises.stat(file.fullPath);
      await db.query(
        "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
        [file.name, file.fullPath, stats.size, folderId, session.user.id, "youtube"]
      );

      console.log(`✅ Saved YouTube video: ${file.name} (${stats.size} bytes)`);

      return NextResponse.json({
        success: true,
        type: "youtube",
        filename: file.name,
        size: stats.size,
      });
    }

    /* ---------------------------------------------------------------------- */
    /*                        CASE 2: NORMAL FILE UPLOAD                      */
    /* ---------------------------------------------------------------------- */
    if (!range || !filenameHeader)
      return NextResponse.json({ error: "Missing upload headers" }, { status: 400 });

    const match = range.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match)
      return NextResponse.json({ error: "Invalid Content-Range header" }, { status: 400 });

    const [, startStr, endStr, totalStr] = match;
    const start = parseInt(startStr);
    const end = parseInt(endStr);
    const total = parseInt(totalStr);
    const filename = decodeURIComponent(filenameHeader);
    const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

    const filePath = path.join(uploadDir, filename);
    const flags = start === 0 ? "w" : "a";

    if (!req.body)
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });

    const fileStream = fs.createWriteStream(filePath, { flags });
    await pump(req.body as any, fileStream);

    if (end + 1 >= total) {
      const stats = await fs.promises.stat(filePath);
      await db.query(
        "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
        [filename, filePath, stats.size, folderId, session.user.id, "file"]
      );
      console.log(`✅ File upload complete: ${filename} (${stats.size} bytes)`);
    }

    return NextResponse.json({ success: true, start, end, total });
  } catch (err: any) {
    console.error("💥 Upload error:", err);
    return NextResponse.json(
      { error: `Unexpected failure: ${err.message}`, stack: err.stack },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                      helper: find the most recent mp4                      */
/* -------------------------------------------------------------------------- */
async function pickMostRecentFile(dir: string, ext: string) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(ext))
      .map(async (d) => {
        const fullPath = path.join(dir, d.name);
        const s = await fs.promises.stat(fullPath);
        return { name: d.name, fullPath, mtimeMs: s.mtimeMs };
      })
  );
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0];
}

/* -------------------------------------------------------------------------- */
/*                (Only needed if you keep manual ffmpeg merges)              */
/* -------------------------------------------------------------------------- */
async function mergeWithFFmpeg(videoPath: string, audioPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      outputPath,
    ]);
    ffmpeg.stderr.on("data", (d) => process.stdout.write(d));
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg failed ${code}`))));
  });
}
