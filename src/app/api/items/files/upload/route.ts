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

// Simple YouTube downloader inspired by Dr-Drake/yt-download
class SimpleYouTubeDownloader {
  private uploadDir: string;

  constructor(private url: string, uploadDir: string) {
    this.uploadDir = uploadDir;
  }

  async getVideoInfo() {
    try {
      console.log("🔍 Getting video info...");
      
      // Simple request options like Dr-Drake's approach
      const requestOptions = {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      };

      const info = await ytdl.getInfo(this.url, { requestOptions });
      
      if (!info.videoDetails) {
        throw new Error('Video not found or unavailable');
      }

      console.log(`✅ Got info: ${info.videoDetails.title}`);
      return info;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to get video info:", errorMessage);
      
      // Provide user-friendly error messages
      if (errorMessage.includes('Video unavailable')) {
        throw new Error('This video is unavailable. It may be private, deleted, or restricted.');
      } else if (errorMessage.includes('age verification') || errorMessage.includes('Sign in')) {
        throw new Error('This video is age-restricted and cannot be downloaded without YouTube authentication.');
      } else if (errorMessage.includes('not found')) {
        throw new Error('Video not found. Please check the URL.');
      } else {
        throw new Error(`Cannot access video: ${errorMessage}`);
      }
    }
  }

  async download(): Promise<{ path: string; size: number; title: string }> {
    const info = await this.getVideoInfo();
    const safeTitle = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
    const outputPath = path.join(this.uploadDir, `${safeTitle}.mp4`);

    return new Promise((resolve, reject) => {
      console.log('🚀 Starting download...');

      try {
        // Choose the best available format
        const format = ytdl.chooseFormat(info.formats, {
          quality: 'highest',
          filter: (format) => format.hasVideo && format.hasAudio && format.container === 'mp4'
        });

        if (!format) {
          // Fallback to any available format
          const fallbackFormat = ytdl.chooseFormat(info.formats, {
            quality: 'highest'
          });
          
          if (!fallbackFormat) {
            throw new Error('No suitable video format available');
          }
        }

        const selectedFormat = format || ytdl.chooseFormat(info.formats, { quality: 'highest' });
        
        console.log(`📹 Selected format: ${selectedFormat.qualityLabel}`);

        const video = ytdl.downloadFromInfo(info, {
          format: selectedFormat,
          highWaterMark: 1 << 25, // 32MB buffer
        });

        let downloadedBytes = 0;
        let totalBytes = selectedFormat.contentLength ? parseInt(selectedFormat.contentLength) : 0;
        let lastProgress = 0;

        video.on('progress', (chunkLength) => {
          downloadedBytes += chunkLength;
          if (totalBytes > 0) {
            const progress = (downloadedBytes / totalBytes) * 100;
            if (progress - lastProgress >= 10) { // Log every 10%
              console.log(`📊 Download progress: ${progress.toFixed(1)}%`);
              lastProgress = progress;
            }
          }
        });

        const fileStream = fs.createWriteStream(outputPath);
        
        video.pipe(fileStream);

        fileStream.on('finish', async () => {
          try {
            const stats = await fs.promises.stat(outputPath);
            console.log(`✅ Download complete: ${safeTitle}.mp4 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            resolve({
              path: outputPath,
              size: stats.size,
              title: `${safeTitle}.mp4`
            });
          } catch (error) {
            reject(new Error('Failed to verify downloaded file'));
          }
        });

        fileStream.on('error', (error) => {
          reject(new Error(`File write error: ${error.message}`));
        });

        video.on('error', (error) => {
          reject(new Error(`Download error: ${error.message}`));
        });

        // 15-minute timeout
        const timeout = setTimeout(() => {
          video.destroy();
          reject(new Error('Download timeout after 15 minutes'));
        }, 15 * 60 * 1000);

        video.on('end', () => clearTimeout(timeout));
        video.on('error', () => clearTimeout(timeout));

      } catch (error) {
        reject(error);
      }
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

      if (!ytdl.validateURL(url))
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

      console.log(`🎬 Starting YouTube download: ${url}`);

      try {
        const downloader = new SimpleYouTubeDownloader(url, uploadDir);
        const result = await downloader.download();

        // Save to database
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

      } catch (error: unknown) {
        console.error("💥 Download failed:", error instanceof Error ? error.message : String(error));
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Simple error responses like Dr-Drake's approach
        return NextResponse.json({ 
          error: errorMessage
        }, { status: 500 });
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

    if (!req.body)
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });

    const fileStream = fs.createWriteStream(filePath, { flags });
    
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
  } catch (err: unknown) {
    console.error("💥 Upload error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      {
        error: `Unexpected failure: ${err instanceof Error ? err.message : String(err)}`
      },
      { status: 500 }
    );
  }
}

// Simple GET endpoint for video info
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
    }

    if (!ytdl.validateURL(url)) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const downloader = new SimpleYouTubeDownloader(url, "");
    const info = await downloader.getVideoInfo();

    return NextResponse.json({
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0]?.url,
      author: info.videoDetails.author.name,
      viewCount: info.videoDetails.viewCount
    });

  } catch (error: unknown) {
    console.error("💥 Video info fetch error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}