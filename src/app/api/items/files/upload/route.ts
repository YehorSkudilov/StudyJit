import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import ytdl from "@distube/ytdl-core";

const pump = promisify(pipeline);

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

      if (!ytdl.validateURL(url)) {
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
      }

      console.log(`🎬 Downloading YouTube video: ${url}`);

      // Enhanced headers with cookies
      const agentOptions = {
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.youtube.com/",
            "Origin": "https://www.youtube.com",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            // Add your YouTube cookies here - get them from browser DevTools
            "Cookie": process.env.YOUTUBE_COOKIES || ""
          },
        },
      };

      // Fetch metadata with retry logic
      let info;
      try {
        info = await ytdl.getInfo(url, agentOptions);
      } catch (error: any) {
        console.error("❌ Failed to get video info:", error.message);
        return NextResponse.json({ 
          error: "Failed to fetch video. YouTube may be blocking the request. Try using cookies." 
        }, { status: 500 });
      }

      const title = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, "_");
      const filename = `${title}.mp4`;
      const filePath = path.join(uploadDir, filename);

      // Get best format with audio
      const videoStream = ytdl(url, {
        quality: "highest",
        filter: (format) => format.hasVideo && format.hasAudio,
        ...agentOptions,
      });

      const fileStream = fs.createWriteStream(filePath);
      await pump(videoStream, fileStream);

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