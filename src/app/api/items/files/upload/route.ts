import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { spawn } from "child_process";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

const pump = promisify(pipeline);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

/* -------------------------------------------------------------------------- */
/*                              Utility helpers                               */
/* -------------------------------------------------------------------------- */

// Optional cookies file (exported from browser via Get cookies.txt extension)
const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");
function getCookiesArgs() {
  if (fs.existsSync(COOKIES_PATH)) return ["--cookies", COOKIES_PATH];
  return [];
}

/* -------------------------------------------------------------------------- */
/*                             YT-DLP Downloader                              */
/* -------------------------------------------------------------------------- */

class SimpleYouTubeDownloader {
  constructor(private url: string, private uploadDir: string) {}

  async getVideoInfo() {
    console.log("🔍 Fetching video info via yt-dlp...");

    const args = [
      "--dump-json",
      "--no-warnings",
      "--no-call-home",
      "--no-playlist",
      ...getCookiesArgs(),
      this.url,
    ];

    return new Promise((resolve, reject) => {
      const proc = spawn("yt-dlp", args);
      let data = "";
      let error = "";

      proc.stdout.on("data", (chunk) => (data += chunk.toString()));
      proc.stderr.on("data", (chunk) => (error += chunk.toString()));

      proc.on("close", (code) => {
        if (code === 0 && data.trim()) {
          try {
            const info = JSON.parse(data);
            console.log(`✅ Got info: ${info.title}`);
            resolve(info);
          } catch (e) {
            reject(new Error("Failed to parse yt-dlp JSON output"));
          }
        } else {
          console.error("❌ yt-dlp info error:", error);
          if (error.includes("Sign in"))
            reject(
              new Error(
                "This video is age-restricted or private. Add cookies.txt to enable authenticated downloads."
              )
            );
          else reject(new Error("Cannot access video: " + error));
        }
      });
    });
  }

  async download(): Promise<{ path: string; size: number; title: string }> {
    const info: any = await this.getVideoInfo();
    const safeTitle = info.title.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
    const outputPath = path.join(this.uploadDir, `${safeTitle}.mp4`);

    const args = [
      "-f",
      "bestvideo+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "-o",
      outputPath,
      "--newline", // Progress output
      "--no-warnings",
      "--no-call-home",
      ...getCookiesArgs(),
      this.url,
    ];

    console.log("🚀 Starting yt-dlp download...");

    return new Promise((resolve, reject) => {
      const proc = spawn("yt-dlp", args);
      let lastProgress = 0;

      proc.stdout.on("data", (chunk) => {
        const line = chunk.toString();
        if (line.includes("[download]")) {
          const match = line.match(/(\d+(?:\.\d+)?)%/);
          if (match) {
            const progress = parseFloat(match[1]);
            if (progress - lastProgress >= 10) {
              console.log(`📊 Download progress: ${progress.toFixed(1)}%`);
              lastProgress = progress;
            }
          }
        }
      });

      proc.stderr.on("data", (chunk) => {
        console.error("yt-dlp:", chunk.toString());
      });

      proc.on("close", async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.promises.stat(outputPath);
            console.log(
              `✅ Download complete: ${safeTitle}.mp4 (${(
                stats.size /
                1024 /
                1024
              ).toFixed(2)} MB)`
            );
            resolve({ path: outputPath, size: stats.size, title: `${safeTitle}.mp4` });
          } catch (e) {
            reject(new Error("Failed to verify downloaded file"));
          }
        } else reject(new Error("yt-dlp exited with code " + code));
      });
    });
  }
}

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

      console.log(`🎬 Starting YouTube download: ${url}`);

      try {
        const downloader = new SimpleYouTubeDownloader(url, uploadDir);
        const result = await downloader.download();

        await db.query(
          "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
          [result.title, result.path, result.size, folderId, session.user.id, "youtube"]
        );

        return NextResponse.json({
          success: true,
          type: "youtube",
          filename: result.title,
          size: result.size,
        });
      } catch (error: any) {
        console.error("💥 Download failed:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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

    const body = req.body as unknown as NodeJS.ReadableStream;
    const fileStream = fs.createWriteStream(filePath, { flags });
    await pump(body, fileStream);

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
    console.error("💥 Upload error:", err.message);
    return NextResponse.json(
      { error: `Unexpected failure: ${err.message}` },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                  GET INFO                                  */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url)
      return NextResponse.json({ error: "URL parameter required" }, { status: 400 });

    const downloader = new SimpleYouTubeDownloader(url, "");
    const info: any = await downloader.getVideoInfo();

    return NextResponse.json({
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      author: info.uploader,
      viewCount: info.view_count,
    });
  } catch (error: any) {
    console.error("💥 Video info fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
