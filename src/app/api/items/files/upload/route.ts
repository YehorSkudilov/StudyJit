import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import ytdl from "@distube/ytdl-core";
import { spawn } from "child_process";

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

      if (!ytdl.validateURL(url))
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

      console.log(`🎬 Downloading YouTube video: ${url}`);

      const requestOptions = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Cookie": process.env.YOUTUBE_COOKIES || "",
        },
      };

      let info;
      try {
        info = await ytdl.getInfo(url, { requestOptions });
      } catch (error: any) {
        console.error("❌ Failed to get video info for:", url);
        console.error({
          name: error.name,
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack,
          cause: error.cause,
        });

        const statusCode = error.statusCode || error.code || "unknown";
        const videoId = ytdl.getURLVideoID(url);
        const summary = [
          "❌ YouTube Metadata Fetch Failed",
          `Video ID: ${videoId}`,
          `Error: ${error.message || "Unknown error"}`,
          `Status: ${statusCode}`,
          "👉 Possible causes:",
          "- YouTube throttled or blocked your IP",
          "- The video is age/region restricted",
          "- Cookies are missing or expired",
          "- ytdl-core is outdated — run: npm install @distube/ytdl-core@latest",
        ].join("\n");

        return NextResponse.json({ error: summary }, { status: 502 });
      }

      const safeTitle = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, "_");
      const videoPath = path.join(uploadDir, `${safeTitle}_video.mp4`);
      const audioPath = path.join(uploadDir, `${safeTitle}_audio.mp4`);
      const outputPath = path.join(uploadDir, `${safeTitle}.mp4`);

      // 🎥 Choose best formats
      const formats = info.formats;
      
      const videoFormats = formats.filter(f => f.hasVideo && !f.hasAudio);
      const audioFormats = formats.filter(f => f.hasAudio && !f.hasVideo);
      
      const videoFormat = videoFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      const audioFormat = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      // ⚙️ Download combined (if available)
      if (!videoFormat || !audioFormat) {
        console.log("➡ Using combined audio+video format...");
        
        const combinedFormats = formats.filter(f => f.hasVideo && f.hasAudio);
        const combinedFormat = combinedFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (!combinedFormat) {
          return NextResponse.json(
            { error: "No suitable format found for download." },
            { status: 500 }
          );
        }

        const stream = ytdl.downloadFromInfo(info, {
          format: combinedFormat,
          requestOptions,
          highWaterMark: 1 << 25,
        });
        const fileStream = fs.createWriteStream(outputPath);
        await pump(stream, fileStream);

        const stats = await fs.promises.stat(outputPath);
        await db.query(
          "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
          [`${safeTitle}.mp4`, outputPath, stats.size, folderId, session.user.id, "youtube"]
        );

        console.log(`✅ Saved combined YouTube video: ${safeTitle}.mp4 (${stats.size} bytes)`);
        return NextResponse.json({
          success: true,
          type: "youtube",
          filename: `${safeTitle}.mp4`,
          size: stats.size,
        });
      }

      // 🎧 Download separate audio/video
      console.log("➡ Downloading separate high-quality video/audio streams...");
      const videoStream = ytdl.downloadFromInfo(info, {
        format: videoFormat,
        requestOptions,
        highWaterMark: 1 << 25,
      });
      const audioStream = ytdl.downloadFromInfo(info, {
        format: audioFormat,
        requestOptions,
        highWaterMark: 1 << 25,
      });

      await Promise.all([
        pump(videoStream, fs.createWriteStream(videoPath)),
        pump(audioStream, fs.createWriteStream(audioPath)),
      ]);
      console.log("✅ Downloaded both audio and video streams.");

      // 🧩 Merge using FFmpeg (requires ffmpeg installed)
      console.log("🎞️ Merging audio and video...");
      await mergeWithFFmpeg(videoPath, audioPath, outputPath);

      // Clean up temp files
      await Promise.all([
        fs.promises.unlink(videoPath).catch(() => {}),
        fs.promises.unlink(audioPath).catch(() => {}),
      ]);

      const stats = await fs.promises.stat(outputPath);
      await db.query(
        "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
        [`${safeTitle}.mp4`, outputPath, stats.size, folderId, session.user.id, "youtube"]
      );

      console.log(`✅ Saved YouTube video: ${safeTitle}.mp4 (${stats.size} bytes)`);

      return NextResponse.json({
        success: true,
        type: "youtube",
        filename: `${safeTitle}.mp4`,
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
    
    // Type assertion for ReadableStream compatibility
    const body = req.body as unknown as NodeJS.ReadableStream;
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
    console.error("💥 Upload error:", err);
    return NextResponse.json(
      {
        error: `Unexpected failure: ${err.message}`,
        stack: err.stack,
        cause: err.cause,
      },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                               FFmpeg Helper                                */
/* -------------------------------------------------------------------------- */
async function mergeWithFFmpeg(videoPath: string, audioPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y", // overwrite
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-strict", "experimental",
      outputPath,
    ]);

    ffmpeg.stderr.on("data", (d) => process.stdout.write(d));
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log("🎬 FFmpeg merge successful!");
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
  });
}