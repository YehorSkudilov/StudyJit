import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { spawn } from "child_process";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { randomUUID } from "crypto";

const pump = promisify(pipeline);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");
const UPLOAD_DIR = path.resolve("/shared-files");
const MAX_CONCURRENT_DOWNLOADS = 3;

const activeDownloads: Record<string, any> = {};

/* -------------------------------------------------------------------------- */
/*                           ✅ FIXED Database Helpers                        */
/* -------------------------------------------------------------------------- */

// ✅ FIXED: MySQL doesn't use RETURNING - uses insertId
async function insertFileAndGetId(
  name: string,
  filePath: string,
  size: number,
  folderId: string | null,
  userId: string,
  type: string
): Promise<string> {
  const [result] = await db.query(
    "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
    [name, filePath, size, folderId, userId, type]
  ) as any;

  if (result.insertId) {
    return result.insertId.toString();
  }
  throw new Error("Database did not return file ID");
}

// ✅ Generic query helper
async function queryDownloads(sql: string, params: any[] = []): Promise<any[]> {
  const [rows] = await db.query(sql, params) as any;
  return Array.isArray(rows) ? rows : [];
}

// ✅ Generic update helper
async function updateDownload(uid: string, updates: Record<string, any>): Promise<void> {
  const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  values.push(uid);
  
  await db.query(
    `UPDATE downloads SET ${setClause}, updated_at = NOW() WHERE uid = ?`,
    values
  );
}

// ✅ Create download record
async function createDownloadRecord(
  uid: string,
  url: string,
  userId: string,
  options: any
): Promise<boolean> {
  try {
    await db.query(
      `INSERT INTO downloads (
        uid, user_id, url, title, step_index, running, finished, paused, 
        options, timestamp_start, created_at, updated_at
      ) VALUES (?, ?, ?, '', 0, 0, 0, 0, ?, ?, NOW(), NOW())`,
      [uid, userId, url, JSON.stringify(options), Date.now()]
    );
    return true;
  } catch (error) {
    console.error("Failed to create download record:", error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                           Enhanced YouTube Downloader                      */
/* -------------------------------------------------------------------------- */

interface DownloadOptions {
  customOutput?: string;
  customArgs?: string;
  selectedHeight?: string;
  maxHeight?: string;
  additionalArgs?: string;
}

class AdvancedYouTubeDownloader {
  private url: string;
  private options: DownloadOptions;
  private userId: string;
  private folderId: string | null;
  private uid: string;

  constructor(
    url: string,
    options: DownloadOptions = {},
    userId: string,
    folderId: string | null,
    uid: string
  ) {
    this.url = url;
    this.options = options;
    this.userId = userId;
    this.folderId = folderId;
    this.uid = uid;
  }

  private getCookiesArgs() {
    return fs.existsSync(COOKIES_PATH) ? ["--cookies", COOKIES_PATH] : [];
  }

  // ✅ FIXED: Made PUBLIC for GET /api/upload?url=...
  public async getVideoInfo(): Promise<any[] | null> {
    const args = [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--no-call-home",
      ...this.getCookiesArgs(),
      this.url,
    ];

    return new Promise((resolve) => {
      const proc = spawn("yt-dlp", args);
      let data = "";
      let error = "";

      proc.stdout.on("data", (chunk) => (data += chunk.toString()));
      proc.stderr.on("data", (chunk) => (error += chunk.toString()));

      proc.on("close", (code) => {
        if (code === 0 && data.trim()) {
          try {
            const info = JSON.parse(data);
            resolve([info]);
          } catch {
            resolve(null);
          }
        } else {
          console.error("❌ yt-dlp info error:", error);
          resolve(null);
        }
      });
    });
  }

  private async generateArgs(): Promise<string[]> {
    let qualityPath = ["-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4"];
    
    if (this.options.selectedHeight || this.options.maxHeight) {
      const heightParam = this.options.selectedHeight || this.options.maxHeight;
      qualityPath = ["-f", `best[height<=${heightParam}]+bestaudio`, "--merge-output-format", "mp4"];
    }

    const args: string[] = [
      "-o",
      path.join(UPLOAD_DIR, "%(title)s.%(ext)s"),
      "--write-info-json",
      "--write-thumbnail",
      "--newline",
      "--no-warnings",
      "--no-call-home",
      ...qualityPath,
      ...this.getCookiesArgs(),
    ];

    if (this.options.customArgs) {
      args.push(...this.options.customArgs.split(",,"));
    }
    if (this.options.additionalArgs) {
      args.push(...this.options.additionalArgs.split(",,"));
    }

    return args;
  }

  async collectInfo(): Promise<{ title: string; expected_size: number; files_to_check: string[] } | null> {
    try {
      const info = await this.getVideoInfo();
      if (!info || info.length === 0) return null;

      const infoObj = info[0];
      const sanitizedTitle = infoObj.title.replace(/[<>:"/\\|?*]/g, '_');
      const expectedSize = infoObj.filesize || infoObj.filesize_approx || 100 * 1024 * 1024;

      await updateDownload(this.uid, {
        title: infoObj.title,
        expected_file_size: expectedSize,
        files_to_check_for_progress: JSON.stringify([sanitizedTitle]),
        step_index: 2
      });

      return {
        title: infoObj.title,
        expected_size: expectedSize,
        files_to_check: [path.join(UPLOAD_DIR, sanitizedTitle)],
      };
    } catch (error) {
      console.error("💥 Info collection failed:", error);
      await this.updateDownloadError("Failed to collect video info");
      return null;
    }
  }

  private async updateDownloadProgress(percent: number) {
    await updateDownload(this.uid, { percent_complete: parseFloat(percent.toFixed(2)) });
  }

  private async updateDownloadError(message: string) {
    await updateDownload(this.uid, { 
      error: message, 
      finished: 1, 
      running: 0 
    });
  }

  private async completeDownload(fileUids: string[]) {
    await updateDownload(this.uid, { 
      finished: 1, 
      running: 0, 
      file_uids: JSON.stringify(fileUids),
      step_index: 3,
      percent_complete: 100
    });
  }

  async download(): Promise<{ file_uids: string[]; container: any } | null> {
    const args = await this.generateArgs();
    
    return new Promise(async (resolve) => {
      const proc = spawn("yt-dlp", args);
      activeDownloads[this.uid] = proc;

      let downloadComplete = false;
      let progressLines: string[] = [];
      let progressInterval: NodeJS.Timeout;

      progressInterval = setInterval(async () => {
        if (!downloadComplete) {
          const recentProgress = progressLines.slice(-10).join('\n');
          const match = recentProgress.match(/(\d+(?:\.\d+)?)%/);
          if (match) {
            const percent = parseFloat(match[1]);
            await this.updateDownloadProgress(percent);
          }
        }
      }, 1000);

      proc.stdout.on("data", (chunk) => {
        const lines = chunk.toString().split('\n');
        progressLines.push(...lines);
        if (progressLines.length > 100) progressLines = progressLines.slice(-100);
      });

      proc.stderr.on("data", async (chunk) => {
        const msg = chunk.toString();
        if (msg.includes("ERROR") || msg.includes("FAILED")) {
          if (progressInterval) clearInterval(progressInterval);
          await this.updateDownloadError("Download failed: " + msg.trim());
          resolve(null);
        }
      });

      proc.on("close", async (code) => {
        if (progressInterval) clearInterval(progressInterval);
        downloadComplete = true;

        if (code === 0) {
          try {
            const files = await fs.promises.readdir(UPLOAD_DIR);
            const mp4Files = files
              .filter(f => f.endsWith('.mp4'))
              .map(f => ({
                name: f,
                fullPath: path.join(UPLOAD_DIR, f),
                mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtime.getTime()
              }))
              .sort((a, b) => b.mtime - a.mtime);

            const recentFiles = mp4Files.slice(0, 3);
            const fileUids: string[] = [];

            for (const file of recentFiles) {
              try {
                const stats = await fs.promises.stat(file.fullPath);
                const fileId = await insertFileAndGetId(
                  file.name,
                  file.fullPath,
                  stats.size,
                  this.folderId,
                  this.userId,
                  "youtube"
                );
                fileUids.push(fileId);
              } catch (fileError) {
                console.error(`Failed to register file ${file.name}:`, fileError);
              }
            }

            if (fileUids.length > 0) {
              await this.completeDownload(fileUids);
              resolve({ file_uids: fileUids, container: { uid: fileUids[0] } });
            } else {
              await this.updateDownloadError("No files found after download");
              resolve(null);
            }
          } catch (err) {
            console.error("💥 Finalization error:", err);
            await this.updateDownloadError("Finalization failed");
            resolve(null);
          }
        } else {
          await this.updateDownloadError(`Download failed with exit code ${code}`);
          resolve(null);
        }
        
        delete activeDownloads[this.uid];
      });

      proc.on("error", async (error) => {
        if (progressInterval) clearInterval(progressInterval);
        await this.updateDownloadError(`Process error: ${error.message}`);
        resolve(null);
        delete activeDownloads[this.uid];
      });
    });
  }

  async startDownloadProcess(): Promise<void> {
    const created = await createDownloadRecord(this.uid, this.url, this.userId, this.options);
    if (!created) throw new Error("Failed to create download");

    await updateDownload(this.uid, { step_index: 1, running: 1 });

    const info = await this.collectInfo();
    if (!info) return;

    await this.download();
  }
}

/* -------------------------------------------------------------------------- */
/*                                  POST API                                  */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const urlHeader = req.headers.get("x-url");
    const folderHeader = req.headers.get("x-folder");
    const optionsHeader = req.headers.get("x-options");
    
    const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;
    const options: DownloadOptions = optionsHeader ? JSON.parse(optionsHeader) : {};

    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

    if (urlHeader) {
      const url = decodeURIComponent(urlHeader.trim());
      const uid = randomUUID();

      if (Object.keys(activeDownloads).length >= MAX_CONCURRENT_DOWNLOADS) {
        return NextResponse.json({ error: "Max concurrent downloads reached" }, { status: 429 });
      }

      const downloader = new AdvancedYouTubeDownloader(url, options, session.user.id, folderId, uid);
      
      downloader.startDownloadProcess().catch((error) => {
        console.error("💥 Background download error:", error);
      });

      if (req.headers.get("accept") === "text/event-stream") {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            const checkInterval = setInterval(async () => {
              try {
                const downloads = await queryDownloads(
                  "SELECT * FROM downloads WHERE uid = ? ORDER BY updated_at DESC LIMIT 1",
                  [uid]
                );

                if (downloads.length > 0) {
                  const download = downloads[0];
                  const data = {
                    uid,
                    status: download.running ? "downloading" : 
                           (download.finished ? "complete" : 
                           (download.error ? "error" : "queued")),
                    percent: download.percent_complete || 0,
                    title: download.title || "Unknown",
                    error: download.error,
                  };

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

                  if (download.finished || download.error) {
                    clearInterval(checkInterval);
                    setTimeout(() => controller.close(), 1000);
                  }
                }
              } catch (err) {
                console.error("Progress check error:", err);
              }
            }, 1000);
          }
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      return NextResponse.json({
        uid,
        status: "queued",
        message: "Download started"
      });
    }

    // ✅ FIXED: File upload - folderId now in scope
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");

    if (!range || !filenameHeader) {
      return NextResponse.json({ error: "Missing upload headers" }, { status: 400 });
    }

    const match = range.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match) {
      return NextResponse.json({ error: "Invalid Content-Range" }, { status: 400 });
    }

    const [, startStr, endStr, totalStr] = match;
    const start = parseInt(startStr);
    const end = parseInt(endStr);
    const total = parseInt(totalStr);
    const filename = decodeURIComponent(filenameHeader);

    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    const flags = start === 0 ? "w" : "a";

    try {
      const body = req.body as unknown as NodeJS.ReadableStream;
      if (!body) throw new Error("No request body");
      
      const fileStream = fs.createWriteStream(filePath, { flags });
      await pump(body, fileStream);

      if (end + 1 >= total) {
        const stats = await fs.promises.stat(filePath);
        await db.query(
          "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
          [filename, filePath, stats.size, folderId, session.user.id, "file"]
        );
      }

      return NextResponse.json({ success: true, start, end, total });
    } catch (error) {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(console.error);
      }
      throw error;
    }
  } catch (err: any) {
    console.error("💥 Upload error:", err);
    return NextResponse.json({ error: `Unexpected failure: ${err.message}` }, { status: 500 });
  }
}

/* -------------------------------------------------------------------------- */
/*                                  PATCH API                                 */
/* -------------------------------------------------------------------------- */

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const action = searchParams.get("action");

    if (!uid || !action) {
      return NextResponse.json({ error: "Missing uid or action" }, { status: 400 });
    }

    const downloads = await queryDownloads(
      "SELECT * FROM downloads WHERE uid = ? AND user_id = ?",
      [uid, session.user.id]
    );

    if (downloads.length === 0) {
      return NextResponse.json({ error: "Download not found" }, { status: 404 });
    }

    const proc = activeDownloads[uid];
    
    switch (action) {
      case "pause":
        if (proc) {
          proc.kill('SIGTERM');
          delete activeDownloads[uid];
        }
        await updateDownload(uid, { paused: 1, running: 0 });
        return NextResponse.json({ success: true });

      case "resume":
        await updateDownload(uid, { paused: 0 });
        return NextResponse.json({ success: true });

      case "cancel":
        if (proc) {
          proc.kill('SIGKILL');
          delete activeDownloads[uid];
        }
        await updateDownload(uid, { 
          error: 'Cancelled', 
          finished: 1, 
          running: 0 
        });
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("💥 Download control error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* -------------------------------------------------------------------------- */
/*                                  GET API                                   */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const urlParam = searchParams.get("url");

    if (uid) {
      const downloads = await queryDownloads(
        "SELECT * FROM downloads WHERE uid = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1",
        [uid, session.user.id]
      );
      return NextResponse.json(downloads[0] || null);
    }

    if (urlParam) {
      // ✅ FIXED: Now works with public getVideoInfo()
      const downloader = new AdvancedYouTubeDownloader(
        urlParam, 
        {}, 
        session.user.id, 
        null, 
        randomUUID()
      );
      const info = await downloader.getVideoInfo();
      if (!info || info.length === 0) {
        return NextResponse.json({ error: "Cannot fetch video info" }, { status: 500 });
      }
      return NextResponse.json({
        title: info[0].title,
        duration: info[0].duration || 0,
        thumbnail: info[0].thumbnail,
        author: info[0].uploader || info[0].channel || "Unknown",
        viewCount: info[0].view_count || 0,
      });
    }

    const downloads = await queryDownloads(
      "SELECT * FROM downloads WHERE user_id = ? ORDER BY timestamp_start DESC LIMIT 50",
      [session.user.id]
    );
    return NextResponse.json(downloads);
  } catch (error: any) {
    console.error("💥 GET error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}