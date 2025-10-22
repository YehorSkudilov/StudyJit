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
    // Multiple request strategies like super_ytdl
    const strategies = [
      {
        name: "Standard Chrome",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
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
      },
      {
        name: "Mobile Safari",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
          },
        }
      },
      {
        name: "Googlebot",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept": "*/*",
          },
        }
      }
    ];

    // Try IP rotation simulation by using different approaches
    for (const strategy of strategies) {
      try {
        console.log(`🔍 Trying ${strategy.name} strategy...`);
        
        this.info = await ytdl.getInfo(this.url, { 
          requestOptions: strategy.requestOptions,
          lang: 'en'
        });

        // Check if video is available
        if (!this.info.videoDetails) {
          throw new Error('Video details not found - video may be unavailable');
        }

        console.log(`✅ Success with ${strategy.name} strategy`);
        return this.info;

      } catch (error: unknown) {
        console.log(`❌ ${strategy.name} failed:`, error instanceof Error ? error.message : String(error));
        
        // Wait a bit before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // If all strategies fail, try with embedded player parameters
    try {
      console.log("🔄 Trying with embedded player parameters...");
      
      const embeddedOptions = {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Referer": "https://www.youtube.com/",
        },
      };

      // Add embedded parameter to URL
      const embeddedUrl = this.url.includes('?') 
        ? `${this.url}&embeds_control=true`
        : `${this.url}?embeds_control=true`;

      this.info = await ytdl.getInfo(embeddedUrl, { 
        requestOptions: embeddedOptions,
        lang: 'en'
      });

      console.log("✅ Success with embedded parameters");
      return this.info;

    } catch (finalError: unknown) {
      console.error("💥 All strategies failed");
      
      // Provide specific error messages based on common issues
      const errorMessage = finalError instanceof Error ? finalError.message : String(finalError);
      
      if (errorMessage.includes('Video unavailable')) {
        throw new Error(`This video is unavailable. It may be:\n- Private or deleted\n- Age-restricted (requires login)\n- Region-restricted\n- Copyright claimed`);
      } else if (errorMessage.includes('Private video')) {
        throw new Error('This video is private and cannot be downloaded.');
      } else if (errorMessage.includes('Sign in')) {
        throw new Error('This video requires age verification. Please sign in to YouTube to watch it.');
      } else if (errorMessage.includes('not found')) {
        throw new Error('Video not found. It may have been removed or the URL is incorrect.');
      } else {
        throw new Error(`Unable to access video: ${errorMessage}\n\nPossible solutions:\n- Check if the video is publicly available\n- Try a different video\n- The video might be region-locked\n- Wait and try again later`);
      }
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
    
    // For live streams, handle differently
    if (this.info.videoDetails.isLive) {
      console.log('⚠️ Live stream detected - format selection may be limited');
    }
    
    // Filter available formats - be more flexible with containers
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

  // Enhanced download with progress tracking and better error handling
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
        
        // Log progress every 5% to avoid spam
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

      // Set timeout for download (10 minutes)
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

  // Main download method with enhanced error handling
  async download(): Promise<{ path: string; size: number; title: string }> {
    if (!this.info) {
      throw new Error('Video info not loaded. Call getVideoInfo() first.');
    }

    const formats = this.selectBestFormats();
    const outputPath = path.join(this.uploadDir, `${this.safeTitle}.mp4`);

    // Prefer combined format for simplicity
    if (formats.combined) {
      console.log('🚀 Downloading combined format...');
      const stream = ytdl.downloadFromInfo(this.info, {
        format: formats.combined,
        highWaterMark: 1 << 25, // 32MB buffer
      });

      await this.downloadWithProgress(stream, outputPath, 'combined');
    } 
    // Fallback to separate audio/video streams
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
        // Cleanup temp files regardless of success/failure
        await Promise.all([
          fs.promises.unlink(videoPath).catch(() => console.log('⚠️ Could not delete video temp file')),
          fs.promises.unlink(audioPath).catch(() => console.log('⚠️ Could not delete audio temp file')),
        ]);
      }
    } else {
      throw new Error('No suitable formats found for download. Available formats may be restricted.');
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
        '-y', // Overwrite output
        '-i', videoPath, // Video input
        '-i', audioPath, // Audio input
        '-c:v', 'copy', // Copy video stream (no re-encoding)
        '-c:a', 'aac', // Encode audio to AAC
        '-b:a', '192k', // Audio bitrate
        '-movflags', '+faststart', // Optimize for streaming
        '-shortest', // Match shortest stream
        '-loglevel', 'info', // Less verbose logging
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        
        // Extract and log progress
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
        reject(new Error(`FFmpeg not available or not installed: ${error.message}`));
      });

      // 15-minute timeout for long videos
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
        
        // Provide user-friendly error messages
        let userMessage = errorMessage;
        let details = "Please try again or contact support if the problem persists";

        if (errorMessage.includes('Video unavailable') || errorMessage.includes('unavailable')) {
          userMessage = "This video is unavailable";
          details = "The video may be private, deleted, age-restricted, or region-locked. Try a different video.";
        } else if (errorMessage.includes('Private video')) {
          userMessage = "This video is private";
          details = "Private videos cannot be downloaded. The uploader has restricted access.";
        } else if (errorMessage.includes('Sign in') || errorMessage.includes('age verification')) {
          userMessage = "Age verification required";
          details = "This video requires age verification. Please sign in to YouTube to watch it.";
        } else if (errorMessage.includes('not found') || errorMessage.includes('removed')) {
          userMessage = "Video not found";
          details = "The video may have been removed or the URL is incorrect.";
        } else if (errorMessage.includes('region') || errorMessage.includes('country')) {
          userMessage = "Region restricted";
          details = "This video is not available in your country. Try using a VPN.";
        }

        return NextResponse.json({ 
          error: userMessage,
          details: details
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
    let userMessage = `Failed to fetch video info: ${errorMessage}`;
    
    if (errorMessage.includes('Video unavailable') || errorMessage.includes('unavailable')) {
      userMessage = "This video is unavailable and cannot be downloaded";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}