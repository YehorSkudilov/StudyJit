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

// Enhanced YouTube downloader inspired by super_ytdl
class SuperYouTubeDownloader {
  private info: any;
  private uploadDir: string;
  private safeTitle: string;

  constructor(private url: string, uploadDir: string, title: string) {
    this.uploadDir = uploadDir;
    this.safeTitle = title.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
  }

  async getVideoInfo() {
    const requestOptions = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "*/*",
        "Cookie": process.env.YOUTUBE_COOKIES || "",
      },
    };

    try {
      this.info = await ytdl.getInfo(this.url, { requestOptions });
      return this.info;
    } catch (error: any) {
      // Retry without cookies if first attempt fails - create new object without Cookie
      console.log("🔄 Retrying without cookies...");
      const { Cookie, ...headersWithoutCookie } = requestOptions.headers;
      const retryOptions = {
        headers: headersWithoutCookie
      };
      this.info = await ytdl.getInfo(this.url, { requestOptions: retryOptions });
      return this.info;
    }
  }

  // Public method to get video details without exposing private info
  getVideoDetails() {
    if (!this.info) {
      throw new Error('Video info not loaded. Call getVideoInfo() first.');
    }
    
    return {
      title: this.info.videoDetails.title,
      duration: this.info.videoDetails.lengthSeconds,
      thumbnail: this.info.videoDetails.thumbnails[0]?.url,
      author: this.info.videoDetails.author.name,
      formats: this.info.formats.length
    };
  }

  // Enhanced format selection like super_ytdl
  private selectBestFormats() {
    const formats = this.info.formats;
    
    // Filter available formats
    const videoFormats = formats.filter((f: any) => 
      f.hasVideo && !f.hasAudio && f.container === 'mp4'
    );
    
    const audioFormats = formats.filter((f: any) => 
      f.hasAudio && !f.hasVideo && (f.container === 'mp4' || f.container === 'webm')
    );
    
    const combinedFormats = formats.filter((f: any) => 
      f.hasVideo && f.hasAudio && f.container === 'mp4'
    );

    // Sort by quality (bitrate + resolution)
    const sortByQuality = (a: any, b: any) => {
      const aScore = (a.bitrate || 0) + (this.getResolutionScore(a) || 0);
      const bScore = (b.bitrate || 0) + (this.getResolutionScore(b) || 0);
      return bScore - aScore;
    };

    return {
      video: videoFormats.sort(sortByQuality)[0],
      audio: audioFormats.sort(sortByQuality)[0],
      combined: combinedFormats.sort(sortByQuality)[0],
    };
  }

  private getResolutionScore(format: any) {
    if (!format.qualityLabel) return 0;
    
    const resolutionScores: { [key: string]: number } = {
      '144p': 100,
      '240p': 200,
      '360p': 300,
      '480p': 400,
      '720p': 500,
      '1080p': 600,
      '1440p': 700,
      '2160p': 800,
    };

    return resolutionScores[format.qualityLabel] || 0;
  }

  // Enhanced download with progress tracking
  async downloadWithProgress(stream: any, filePath: string, type: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let downloadedBytes = 0;
      let totalBytes = 0;
      let lastProgress = 0;

      stream.on('info', (info: any) => {
        totalBytes = info.size;
        console.log(`📥 Downloading ${type} (${this.formatBytes(totalBytes)})`);
      });

      stream.on('progress', (chunkLength: number) => {
        downloadedBytes += chunkLength;
        const progress = totalBytes ? (downloadedBytes / totalBytes) * 100 : 0;
        
        // Only log progress every 10% to avoid spam
        if (progress - lastProgress >= 10) {
          console.log(`📊 ${type} progress: ${progress.toFixed(1)}%`);
          lastProgress = progress;
        }
      });

      const fileStream = fs.createWriteStream(filePath);
      stream.pipe(fileStream);

      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Main download method
  async download(): Promise<{ path: string; size: number; title: string }> {
    if (!this.info) {
      throw new Error('Video info not loaded. Call getVideoInfo() first.');
    }

    const formats = this.selectBestFormats();
    const outputPath = path.join(this.uploadDir, `${this.safeTitle}.mp4`);

    console.log('🎯 Selected formats:', {
      video: formats.video?.qualityLabel,
      audio: formats.audio?.audioQuality,
      combined: formats.combined?.qualityLabel
    });

    // Prefer combined format for simplicity
    if (formats.combined) {
      console.log('🚀 Downloading combined format...');
      const stream = ytdl.downloadFromInfo(this.info, {
        format: formats.combined,
        highWaterMark: 1 << 25,
      });

      await this.downloadWithProgress(stream, outputPath, 'combined');
    } 
    // Fallback to separate audio/video streams
    else if (formats.video && formats.audio) {
      console.log('🔄 Downloading separate streams...');
      
      const videoPath = path.join(this.uploadDir, `${this.safeTitle}_video.tmp`);
      const audioPath = path.join(this.uploadDir, `${this.safeTitle}_audio.tmp`);

      const videoStream = ytdl.downloadFromInfo(this.info, {
        format: formats.video,
        highWaterMark: 1 << 25,
      });

      const audioStream = ytdl.downloadFromInfo(this.info, {
        format: formats.audio,
        highWaterMark: 1 << 25,
      });

      await Promise.all([
        this.downloadWithProgress(videoStream, videoPath, 'video'),
        this.downloadWithProgress(audioStream, audioPath, 'audio'),
      ]);

      console.log('🎞️ Merging streams with FFmpeg...');
      await this.mergeWithFFmpeg(videoPath, audioPath, outputPath);

      // Cleanup temp files
      await Promise.all([
        fs.promises.unlink(videoPath).catch(() => {}),
        fs.promises.unlink(audioPath).catch(() => {}),
      ]);
    } else {
      throw new Error('No suitable formats found for download');
    }

    const stats = await fs.promises.stat(outputPath);
    return {
      path: outputPath,
      size: stats.size,
      title: this.safeTitle + '.mp4'
    };
  }

  private async mergeWithFFmpeg(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting FFmpeg merge...');
      
      const ffmpegArgs = [
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Extract and log progress
        const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) {
          process.stdout.write(`⏱️  FFmpeg progress: ${timeMatch[1]}\r`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ FFmpeg merge completed!');
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg not available: ${error.message}`));
      });

      // 10-minute timeout
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('FFmpeg merge timeout'));
      }, 10 * 60 * 1000);
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

      console.log(`🎬 Starting enhanced YouTube download: ${url}`);

      try {
        // Get video info first to create proper title
        const tempDownloader = new SuperYouTubeDownloader(url, uploadDir, "temp");
        const info = await tempDownloader.getVideoInfo();
        const videoDetails = tempDownloader.getVideoDetails();
        
        // Create downloader with proper title
        const safeTitle = info.videoDetails.title.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
        const downloader = new SuperYouTubeDownloader(url, uploadDir, safeTitle);
        
        // Re-fetch info for the new downloader instance
        await downloader.getVideoInfo();
        const result = await downloader.download();

        // Save to database
        await db.query(
          "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
          [result.title, result.path, result.size, folderId, session.user.id, "youtube"]
        );

        console.log(`✅ YouTube download complete: ${result.title} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);

        return NextResponse.json({
          success: true,
          type: "youtube",
          filename: result.title,
          size: result.size,
          title: videoDetails.title,
          duration: videoDetails.duration,
          thumbnail: videoDetails.thumbnail,
        });

      } catch (error: any) {
        console.error("💥 Enhanced download failed:", error);
        
        const errorSummary = [
          "❌ YouTube Download Failed",
          `URL: ${url}`,
          `Error: ${error.message}`,
          "👉 Possible solutions:",
          "- Try a different video",
          "- Check internet connection",
          "- Video might be restricted or private",
          "- Ensure FFmpeg is installed for high-quality downloads",
        ].join("\n");

        return NextResponse.json({ error: errorSummary }, { status: 500 });
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
        details: "Please try again or contact support if the problem persists"
      },
      { status: 500 }
    );
  }
}

// Additional helper endpoint for getting video info without downloading
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

    const downloader = new SuperYouTubeDownloader(url, "", "video");
    await downloader.getVideoInfo();
    const videoDetails = downloader.getVideoDetails();

    return NextResponse.json(videoDetails);

  } catch (error: any) {
    console.error("💥 Video info fetch error:", error);
    return NextResponse.json(
      { error: `Failed to fetch video info: ${error.message}` },
      { status: 500 }
    );
  }
}