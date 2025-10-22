import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import ytDlpWrap from "yt-dlp-wrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const urlHeader = req.headers.get("x-url");
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");
    const folderHeader = req.headers.get("x-folder");

    const uploadDir = "/shared-files";
    await fs.promises.mkdir(uploadDir, { recursive: true });

    /* ------------------ CASE 1: YouTube URL Upload ------------------ */
    if (urlHeader) {
      const url = decodeURIComponent(urlHeader.trim());
      const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

      console.log(`🎬 Downloading YouTube video: ${url}`);

      try {
        const ytDlp = new ytDlpWrap();
        
        // Get video info first
        const info = await ytDlp.getVideoInfo(url);
        const title = info.title.replace(/[\\/:*?"<>|]/g, "_");
        const filename = `${title}.mp4`;
        const filePath = path.join(uploadDir, filename);

        // Download the video
        await ytDlp.execPromise([
          url,
          "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
          "-o", filePath,
          "--no-playlist",
          "--no-warnings",
          "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "--referer", "https://www.youtube.com/",
          // Add cookies if you have them
          ...(process.env.YOUTUBE_COOKIES_FILE ? ["--cookies", process.env.YOUTUBE_COOKIES_FILE] : []),
        ]);

        // Save record in DB
        const stats = await fs.promises.stat(filePath);
        await db.query(
          "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
          [filename, filePath, stats.size, folderId, session.user.id, "youtube"]
        );

        console.log(`✅ YouTube video saved: ${filename} (${stats.size} bytes)`);

        return NextResponse.json({
          success: true,
          type: "youtube",
          filename,
          size: stats.size,
        });

      } catch (error: any) {
        console.error("❌ YouTube download failed:", error.message);
        return NextResponse.json({ 
          error: `Failed to download video: ${error.message}` 
        }, { status: 500 });
      }
    }

    /* ------------------ CASE 2: Normal File Upload ------------------ */
    if (!range || !filenameHeader)
      return NextResponse.json({ error: "Missing headers" }, { status: 400 });

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

    const { pipeline } = await import("stream");
    const { promisify } = await import("util");
    const pump = promisify(pipeline);

    const fileStream = fs.createWriteStream(filePath, { flags });
    await pump(req.body as any, fileStream);

    if (end + 1 >= total) {
      await db.query(
        "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
        [filename, filePath, total, folderId, session.user.id, "file"]
      );
      console.log(`✅ Upload completed: ${filename} (${total} bytes)`);
    }

    return NextResponse.json({ success: true, start, end, total, folderId });
  } catch (err: any) {
    console.error("💥 Upload error:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}