// app/api/upload/route.ts (or wherever your route lives)

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

/* -------------------------------------------------------------------------- */
/*                             Next.js Runtime Flags                           */
/* -------------------------------------------------------------------------- */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

/* -------------------------------------------------------------------------- */
/*                                   Logger                                   */
/* -------------------------------------------------------------------------- */
const logger = {
  info: (...args: any[]) => console.log("ℹ️", ...args),
  warn: (...args: any[]) => console.warn("⚠️", ...args),
  error: (...args: any[]) => console.error("💥", ...args),
  verbose: (...args: any[]) => console.log("🔎", ...args),
  debug: (...args: any[]) => console.log("🐞", ...args),
};

/* -------------------------------------------------------------------------- */
/*                              Utility Helpers                               */
/* -------------------------------------------------------------------------- */

const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");
const DEFAULT_UPLOAD_DIR = path.resolve("/shared-files"); // change if needed

function getCookiesArgs() {
  return fs.existsSync(COOKIES_PATH) ? ["--cookies", COOKIES_PATH] : [];
}

function sanitizeFilenamePart(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
}

function removeFileExtension(filename: string) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}

function formatDateString(dateString?: string) {
  if (!dateString) return "N/A";
  return `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
}

function injectArgs(original: string[], toInject: string[]) {
  // Non-destructive arg injection similar to your util
  const updated = original.slice();
  for (let i = 0; i < toInject.length; i++) {
    const arg = toInject[i];
    if (
      ["-o", "--output", "-f", "--format", "--username", "--password", "--cookies"].includes(arg)
    ) {
      // ensure we replace existing pair if present
      const idx = updated.indexOf(arg);
      if (idx !== -1) updated.splice(idx, 2);
      updated.push(arg, toInject[i + 1]);
      i++;
    } else if (!updated.includes(arg)) {
      updated.push(arg);
    }
  }
  return updated;
}

/* -------------------------------------------------------------------------- */
/*                              Types & Interfaces                             */
/* -------------------------------------------------------------------------- */

interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  uploader_url?: string;
  view_count: number;
  upload_date?: string; // yyyymmdd
  description?: string;
  artist?: string;
  playlist_index?: number;
  playlist_title?: string;
  _filename?: string;
  [key: string]: any;
}

type DownloadType = "video" | "audio";

interface DownloadOptions {
  type: DownloadType;
  height?: string;
  bitrate?: string; // for audio
  includeThumbnail?: boolean;
  generateNFO?: boolean;
  customArgs?: string; // comma-separated flags
  customOutput?: string; // %(title)s.%(ext)s (pattern)
}

/* -------------------------------------------------------------------------- */
/*                        Optional ID3 / NFO (safe imports)                   */
/* -------------------------------------------------------------------------- */

let NodeID3: any | null = null;
let xmlbuilder2: any | null = null;
try {
  // These are optional; only used if available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NodeID3 = require("node-id3");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  xmlbuilder2 = require("xmlbuilder2");
} catch {
  // no-op (keep API working even if modules not installed)
}

/* -------------------------------------------------------------------------- */
/*                        Unified SimpleYouTubeDownloader                      */
/* -------------------------------------------------------------------------- */

class SimpleYouTubeDownloader {
  constructor(private url: string, private outputDir: string) {}

  async getVideoInfo(): Promise<VideoInfo> {
    logger.info("🔍 Fetching video info via yt-dlp");
    const args = [
      "--dump-json",
      "--no-warnings",
      "--no-call-home",
      "--no-playlist",
      ...getCookiesArgs(),
      this.url,
    ];

    const { stdout, stderr, code } = await runYtDlp(args);
    if (code === 0 && stdout.trim()) {
      try {
        const info = JSON.parse(stdout) as VideoInfo;
        logger.info(`✅ Got info: ${info.title}`);
        return info;
      } catch {
        throw new Error("Failed to parse yt-dlp JSON output");
      }
    } else {
      logger.error("❌ yt-dlp info error:", stderr);
      if (
        /Sign in|private|age restricted|HTTP Error 403/i.test(stderr ?? "")
      ) {
        throw new Error(
          "This video is age-restricted or private. Add cookies.txt for authenticated downloads."
        );
      }
      throw new Error("Cannot access video: " + (stderr || "unknown error"));
    }
  }

  buildArgs(info: VideoInfo, opts: DownloadOptions, infoOnly = false) {
    const isAudio = opts.type === "audio";
    const basePattern = sanitizeFilenamePart(opts.customOutput || "%(title)s.%(ext)s");
    const outputPattern = path.join(this.outputDir, basePattern);

    let args: string[] = ["-o", outputPattern];

    if (!infoOnly) {
      if (isAudio) {
        args.push("-f", "bestaudio", "-x", "--audio-format", "mp3");
        if (opts.bitrate) args.push("--audio-quality", opts.bitrate);
      } else {
        // best video+audio, fallback best
        if (opts.height) {
          args.push("-f", `best[height<=${opts.height}]+bestaudio/best`);
        } else {
          args.push("-f", "bestvideo+bestaudio/best");
        }
        args.push("--merge-output-format", "mp4");
      }

      args.push("--write-info-json");
      if (opts.includeThumbnail) args.push("--write-thumbnail");
      args.push("--newline", "--no-warnings", "--no-call-home");
    } else {
      args.push("--dump-json");
    }

    args = injectArgs(args, getCookiesArgs());
    if (opts.customArgs) {
      // comma-separated custom flags, e.g. "--proxy,http://...,--embed-subs"
      const extras = opts.customArgs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      args = injectArgs(args, extras);
    }

    args.push(this.url);
    return args;
  }

  async downloadWithSSE(
    opts: DownloadOptions,
    onProgress: (kind: "progress" | "status" | "error", payload: string) => void
  ) {
    await fs.promises.mkdir(this.outputDir, { recursive: true });
    const info = await this.getVideoInfo();

    const args = this.buildArgs(info, opts, false);
    const proc = spawn("yt-dlp", args);

    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      const line = chunk.toString().trim();
      // --newline emits a lot: filter % lines
      const m = line.match(/(\d+(?:\.\d+)?)%/);
      if (m) onProgress("progress", m[1]);
      else if (line) onProgress("status", line);
    });

    proc.stderr.on("data", (chunk) => {
      const msg = chunk.toString();
      stderr += msg;
      logger.warn("yt-dlp stderr:", msg);
      if (/Sign in|Private|HTTP Error 403|age restricted/i.test(msg)) {
        onProgress("error", "auth");
      }
    });

    const exitCode: number = await new Promise((res) => {
      proc.on("close", (c) => res(c ?? 0));
      proc.on("error", () => res(1));
    });

    if (exitCode !== 0) {
      throw new Error(stderr || `yt-dlp exited with code ${exitCode}`);
    }

    // Find downloaded file (most recent matching title)
    const sanitizedTitle = sanitizeFilenamePart(info.title);
    const files = await fs.promises.readdir(this.outputDir);
    // Look for mp4 (video) or mp3 (audio)
    const targetExt = opts.type === "audio" ? ".mp3" : ".mp4";
    const found = files
      .filter((f) => f.endsWith(targetExt) && f.includes(sanitizedTitle))
      .map((f) => ({ f, time: fs.statSync(path.join(this.outputDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)[0];

    if (!found) {
      throw new Error("No output media file found after download.");
    }

    const finalName = found.f;
    const fullPath = path.join(this.outputDir, finalName);

    // Optional: Post-process (ID3 + NFO)
    await this.applyPostProcessing(info, fullPath, opts);

    return { info, finalName, fullPath };
  }

  private async applyPostProcessing(info: VideoInfo, mediaPath: string, opts: DownloadOptions) {
    try {
      if (opts.type === "audio" && NodeID3) {
        NodeID3.write(
          {
            title: info.title,
            artist: info.artist || info.uploader,
          },
          mediaPath
        );
      }
    } catch (e: any) {
      logger.warn("ID3 tagging failed:", e?.message || e);
    }

    try {
      if (opts.generateNFO && xmlbuilder2) {
        const { create } = xmlbuilder2;
        const nfoPath = removeFileExtension(mediaPath) + ".nfo";
        const nfoObj = {
          episodedetails: {
            title: info.title,
            episode: info.playlist_index || undefined,
            premiered: formatDateString(info.upload_date),
            plot:
              `${info.uploader_url ?? ""}\n${info.description ?? ""}\n${
                info.playlist_title ?? ""
              }`.trim(),
            director: info.artist || info.uploader,
          },
        };
        const xml = create(nfoObj).end({ prettyPrint: true });
        fs.writeFileSync(nfoPath, xml);
      }
    } catch (e: any) {
      logger.warn("NFO generation failed:", e?.message || e);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Runner                                    */
/* -------------------------------------------------------------------------- */

async function runYtDlp(args: string[]) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const proc = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    proc.on("error", () => resolve({ stdout, stderr: "spawn error", code: 1 }));
  });
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
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");
    const folderHeader = req.headers.get("x-folder");
    const typeHeader = (req.headers.get("x-type") || "video").toLowerCase() as DownloadType;
    const heightHeader = req.headers.get("x-height") || undefined;
    const bitrateHeader = req.headers.get("x-bitrate") || undefined;
    const includeThumbHeader = req.headers.get("x-include-thumbnail") === "true";
    const generateNFOHeader = req.headers.get("x-generate-nfo") === "true";
    const customArgsHeader = req.headers.get("x-custom-args") || undefined;
    const customOutputHeader = req.headers.get("x-custom-output") || undefined;

    const uploadDir = DEFAULT_UPLOAD_DIR;
    await fs.promises.mkdir(uploadDir, { recursive: true });

    /* ---------------------------------------------------------------------- */
    /*                          Case 1: YouTube (URL)                          */
    /* ---------------------------------------------------------------------- */
    if (urlHeader) {
      const url = decodeURIComponent(urlHeader.trim());
      const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

      // SSE progress stream
      if (req.headers.get("accept") === "text/event-stream") {
        const encoder = new TextEncoder();

        const readable = new ReadableStream({
          async start(controller) {
            logger.info(`🎬 Starting yt-dlp download: ${url}`);
            const send = (data: string) => controller.enqueue(encoder.encode(data));

            try {
              const dl = new SimpleYouTubeDownloader(url, uploadDir);
              const { info, finalName, fullPath } = await dl.downloadWithSSE(
                {
                  type: typeHeader,
                  height: heightHeader,
                  bitrate: bitrateHeader,
                  includeThumbnail: includeThumbHeader,
                  generateNFO: generateNFOHeader,
                  customArgs: customArgsHeader || undefined,
                  customOutput: customOutputHeader || undefined,
                },
                (kind, payload) => {
                  if (kind === "progress") send(`data: progress|${payload}\n\n`);
                  else if (kind === "status") send(`data: status|${payload}\n\n`);
                  else if (kind === "error") send(`data: error|${payload}\n\n`);
                }
              );

              const stats = await fs.promises.stat(fullPath);
              await db.query(
                "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
                [finalName, fullPath, stats.size, folderId, session.user.id, "youtube"]
              );

              send(`data: complete|${finalName}\n\n`);
              logger.info(`✅ Download complete: ${finalName}`);
            } catch (e: any) {
              logger.error("Download error:", e?.message || e);
              send(`data: error|${e?.message || "Download failed"}\n\n`);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Non-SSE fallback — return info only
      try {
        const dl = new SimpleYouTubeDownloader(url, uploadDir);
        const info = await dl.getVideoInfo();
        return NextResponse.json({ info });
      } catch (error: any) {
        logger.error("Info fetch failed:", error?.message || error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                        Case 2: Chunked File Upload                      */
    /* ---------------------------------------------------------------------- */
    if (!range || !filenameHeader) {
      return NextResponse.json({ error: "Missing upload headers" }, { status: 400 });
    }

    const match = range.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match) {
      return NextResponse.json({ error: "Invalid Content-Range" }, { status: 400 });
    }

    const [, startStr, endStr, totalStr] = match;
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    const total = parseInt(totalStr, 10);

    const filenameRaw = decodeURIComponent(filenameHeader);
    if (!filenameRaw || filenameRaw.includes("..") || /[\/\\]/.test(filenameRaw)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const safeName = sanitizeFilenamePart(filenameRaw);
    const filePath = path.join(uploadDir, safeName);
    const flags = start === 0 ? "w" : "a";

    try {
      const body = req.body as unknown as NodeJS.ReadableStream;
      if (!body) throw new Error("No request body");

      const fileStream = fs.createWriteStream(filePath, { flags });
      await pump(body, fileStream);

      // If last chunk, finalize + DB insert
      if (end + 1 >= total) {
        const stats = await fs.promises.stat(filePath);
        const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

        await db.query(
          "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
          [safeName, filePath, stats.size, folderId, session.user.id, "file"]
        );
        logger.info(`✅ File upload complete: ${safeName} (${stats.size} bytes)`);
      }

      return NextResponse.json({ success: true, start, end, total });
    } catch (error) {
      // Clean up incomplete file on error
      try {
        if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
      } catch (cleanupError) {
        logger.warn("Failed to clean up file:", cleanupError);
      }
      throw error;
    }
  } catch (err: any) {
    logger.error("Upload error:", err);
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Missing ?url parameter" }, { status: 400 });
    }

    const dl = new SimpleYouTubeDownloader(url, DEFAULT_UPLOAD_DIR);
    const info = await dl.getVideoInfo();

    return NextResponse.json({
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      author: info.uploader,
      viewCount: info.view_count,
      uploadDate: info.upload_date ? formatDateString(info.upload_date) : null,
      id: info.id,
    });
  } catch (error: any) {
    logger.error("Video info fetch error:", error?.message || error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
