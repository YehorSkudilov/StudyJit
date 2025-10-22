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
    // Get YouTube cookies from environment variables
    const youtubeCookies = process.env.YOUTUBE_COOKIES || '';
    
    // Multiple request strategies with cookie support
    const strategies = [
      {
        name: "Authenticated Chrome",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Cookie": youtubeCookies,
          },
        }
      },
      {
        name: "Standard Chrome",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
          },
        }
      },
      {
        name: "Linux Chrome",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Origin": "https://www.youtube.com",
            "Referer": "https://www.youtube.com/",
          },
        }
      }
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        console.log(`🔍 Trying ${strategy.name} strategy...`);
        
        this.info = await ytdl.getInfo(this.url, { 
          requestOptions: strategy.requestOptions,
          lang: 'en'
        });

        // Check if video is available
        if (!this.info.videoDetails) {
          throw new Error('Video details not found');
        }

        console.log(`✅ Success with ${strategy.name} strategy`);
        return this.info;

      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.log(`❌ ${strategy.name} failed:`, lastError.message);
        
        // Wait a bit before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // If all strategies fail, provide specific guidance
    if (lastError?.message.includes('age') || lastError?.message.includes('sign in') || lastError?.message.includes('confirm')) {
      throw new Error(`AGE_VERIFICATION_REQUIRED: This video is age-restricted and requires YouTube authentication. ${youtubeCookies ? 'The provided cookies may be invalid or expired.' : 'No authentication cookies provided.'}`);
    } else if (lastError?.message.includes('Video unavailable')) {
      throw new Error(`VIDEO_UNAVAILABLE: This video is not available. It may be private, deleted, or region-restricted.`);
    } else {
      throw new Error(`DOWNLOAD_FAILED: Unable to access video: ${lastError?.message}`);
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
      formats: this.info.formats.length,
      isLive: this.info.videoDetails.isLive,
      viewCount: this.info.videoDetails.viewCount
    };
  }

  // Enhanced format selection like super_ytdl
  private selectBestFormats() {
    const formats = this.info.formats;
    
    console.log(`📊 Available formats: ${formats.length}`);
    
    // Filter available formats
    const videoFormats = formats.filter((f: any) => 
      f.hasVideo && !f.hasAudio && (f.container === 'mp4' || f.container === 'webm' || f.codecs?.includes('avc1'))
    );
    
    const audioFormats = formats.filter((f: any) => 
      f.hasAudio && !f.hasVideo && (f.container === 'mp4' || f.container === 'webm' || f.container === 'm4a' || f.codecs?.includes('mp4a'))
    );
    
    const combinedFormats = formats.filter((f: any) => 
      f.hasVideo && f.hasAudio && (f.container === 'mp4' || f.container === 'webm' || f.codecs?.includes('avc1'))
    );

    console.log(`🎯 Found ${combinedFormats.length} combined, ${videoFormats.length} video, ${audioFormats.length} audio formats`);

    // Sort by quality (bitrate + resolution)
    const sortByQuality = (a: any, b: any) => {
      const aScore = (a.bitrate || 0) + (this.getResolutionScore(a) || 0);
      const bScore = (b.bitrate || 0) + (this.getResolutionScore(b) || 0);
      return bScore - aScore;
    };

    const selected = {
      video: videoFormats.sort(sortByQuality)[0],
      audio: audioFormats.sort(sortByQuality)[0],
      combined: combinedFormats.sort(sortByQuality)[0],
    };

    // Log selected formats
    if (selected.combined) {
      console.log(`🎯 Selected combined: ${selected.combined.qualityLabel} (${selected.combined.container})`);
    }
    if (selected.video) {
      console.log(`🎯 Selected video: ${selected.video.qualityLabel} (${selected.video.container})`);
    }
    if (selected.audio) {
      console.log(`🎯 Selected audio: ${selected.audio.audioQuality} (${selected.audio.container})`);
    }

    return selected;
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
      '4320p': 900,
    };

    return resolutionScores[format.qualityLabel] || 0;
  }

  // Enhanced download with progress tracking
  async downloadWithProgress(stream: any, filePath: string, type: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let downloadedBytes = 0;
      let totalBytes = 0;
      let lastProgress = 0;
      let startTime = Date.now();

      stream.on('info', (info: any) => {
        totalBytes = info.size;
        console.log(`📥 Downloading ${type} (${this.formatBytes(totalBytes)})`);
        startTime = Date.now();
      });

      stream.on('progress', (chunkLength: number) => {
        downloadedBytes += chunkLength;
        const progress = totalBytes ? (downloadedBytes / totalBytes) * 100 : 0;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
        
        if (progress - lastProgress >= 5) {
          console.log(`📊 ${type}: ${progress.toFixed(1)}% - ${this.formatBytes(speed)}/s`);
          lastProgress = progress;
        }
      });

      const fileStream = fs.createWriteStream(filePath);
      stream.pipe(fileStream);

      fileStream.on('finish', () => {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`✅ ${type} download completed in ${elapsed.toFixed(1)}s`);
        resolve();
      });
      
      fileStream.on('error', (error: Error) => {
        console.error(`❌ ${type} file stream error:`, error);
        reject(error);
      });
      
      stream.on('error', (error: Error) => {
        console.error(`❌ ${type} download stream error:`, error);
        reject(error);
      });

      const timeout = setTimeout(() => {
        stream.destroy();
        reject(new Error(`${type} download timeout after 10 minutes`));
      }, 10 * 60 * 1000);

      stream.on('end', () => clearTimeout(timeout));
      stream.on('error', () => clearTimeout(timeout));
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async download(): Promise<{ path: string; size: number; title: string }> {
    if (!this.info) {
      throw new Error('Video info not loaded. Call getVideoInfo() first.');
    }

    const formats = this.selectBestFormats();
    const outputPath = path.join(this.uploadDir, `${this.safeTitle}.mp4`);

    if (formats.combined) {
      console.log('🚀 Downloading combined format...');
      const stream = ytdl.downloadFromInfo(this.info, {
        format: formats.combined,
        highWaterMark: 1 << 25,
      });

      await this.downloadWithProgress(stream, outputPath, 'combined');
    } 
    else if (formats.video && formats.audio) {
      console.log('🔄 Downloading separate streams...');
      
      const videoPath = path.join(this.uploadDir, `${this.safeTitle}_video.tmp`);
      const audioPath = path.join(this.uploadDir, `${this.safeTitle}_audio.tmp`);

      try {
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

      } finally {
        await Promise.all([
          fs.promises.unlink(videoPath).catch(() => console.log('⚠️ Could not delete video temp file')),
          fs.promises.unlink(audioPath).catch(() => console.log('⚠️ Could not delete audio temp file')),
        ]);
      }
    } else {
      throw new Error('No suitable formats found for download.');
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
        '-loglevel', 'info',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        
        const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) {
          process.stdout.write(`⏱️  FFmpeg: ${timeMatch[1]}\r`);
        }
      });

      ffmpeg.on('close', (code: number) => {
        if (code === 0) {
          console.log('\n✅ FFmpeg merge completed successfully!');
          resolve();
        } else {
          console.error('\n❌ FFmpeg failed with code:', code);
          reject(new Error(`FFmpeg process failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error: Error) => {
        console.error('❌ Failed to spawn FFmpeg:', error);
        reject(new Error(`FFmpeg not available: ${error.message}`));
      });

      const timeout = setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('FFmpeg merge timeout after 15 minutes'));
      }, 15 * 60 * 1000);

      ffmpeg.on('close', () => clearTimeout(timeout));
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

      } catch (error: unknown) {
        console.error("💥 Enhanced download failed:", error instanceof Error ? error.message : String(error));
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle age verification specifically
        if (errorMessage.includes('AGE_VERIFICATION_REQUIRED')) {
          return NextResponse.json({ 
            error: "Age verification required",
            details: `This video is age-restricted and requires YouTube authentication.${process.env.YOUTUBE_COOKIES ? ' The provided cookies may be invalid or expired.' : ' No authentication cookies configured.'}`,
            solution: "To download age-restricted videos:\n1. Sign in to YouTube in your browser\n2. Export your cookies and add them to YOUTUBE_COOKIES environment variable\n3. Or try a different, non-age-restricted video",
            requiresAuth: true
          }, { status: 403 });
        } else if (errorMessage.includes('VIDEO_UNAVAILABLE')) {
          return NextResponse.json({ 
            error: "Video unavailable",
            details: "This video is not available for download. It may be private, deleted, or region-restricted."
          }, { status: 404 });
        } else {
          return NextResponse.json({ 
            error: "Download failed",
            details: errorMessage
          }, { status: 500 });
        }
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
        error: `Unexpected failure: ${err instanceof Error ? err.message : String(err)}`,
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

  } catch (error: unknown) {
    console.error("💥 Video info fetch error:", error instanceof Error ? error.message : String(error));
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('AGE_VERIFICATION_REQUIRED')) {
      return NextResponse.json({ 
        error: "Age verification required",
        details: "This video is age-restricted and cannot be accessed without authentication.",
        requiresAuth: true
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: `Failed to fetch video info: ${errorMessage}` },
      { status: 500 }
    );
  }
}