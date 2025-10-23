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
/*                              Utility Helpers                               */
/* -------------------------------------------------------------------------- */

const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");

function getCookiesArgs() {
  return fs.existsSync(COOKIES_PATH) ? ["--cookies", COOKIES_PATH] : [];
}

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "_");
}

/* -------------------------------------------------------------------------- */
/*                            YouTube Info Fetcher                            */
/* -------------------------------------------------------------------------- */

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
  description?: string;
  upload_date?: string;
  [key: string]: any;
}

class SimpleYouTubeDownloader {
  constructor(private url: string, private uploadDir: string) {}

  async getVideoInfo(): Promise<VideoInfo> {
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
            const info = JSON.parse(data) as VideoInfo;
            console.log(`✅ Got info: ${info.title}`);
            resolve(info);
          } catch {
            reject(new Error("Failed to parse yt-dlp JSON output"));
          }
        } else {
          console.error("❌ yt-dlp info error:", error);
          if (error.includes("Sign in") || error.includes("private") || error.includes("age restricted")) {
            reject(
              new Error(
                "This video is age-restricted or private. Add cookies.txt for authenticated downloads."
              )
            );
          } else {
            reject(new Error("Cannot access video: " + error));
          }
        }
      });
    });
  }

  async downloadWithResolution(resolution: string): Promise<void> {
    await fs.promises.mkdir(this.uploadDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const args = [
        "-f",
        `bestvideo[height=${resolution}]+bestaudio/best[height<=${resolution}]`,
        "--merge-output-format",
        "mp4",
        "-o",
        path.join(this.uploadDir, "%(title)s.%(ext)s"),
        "--no-warnings",
        "--no-call-home",
        "--newline",
        ...getCookiesArgs(),
        this.url,
      ];

      const proc = spawn("yt-dlp", args);
      proc.stdout.on("data", (chunk) => process.stdout.write(chunk.toString()));
      proc.stderr.on("data", (chunk) => process.stderr.write(chunk.toString()));

      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited with code ${code}`));
      });
    });
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
    const resHeader = req.headers.get("x-resolution");
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");
    const folderHeader = req.headers.get("x-folder");
    const uploadDir = path.resolve("/shared-files");

    await fs.promises.mkdir(uploadDir, { recursive: true });

    /* ---------------------------------------------------------------------- */
    /*                          Case 1: YouTube Download                      */
    /* ---------------------------------------------------------------------- */
    if (urlHeader) {
      const url = decodeURIComponent(urlHeader.trim());
      const resolution = resHeader || "720";
      const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

      // Stream progress via SSE
      if (req.headers.get("accept") === "text/event-stream") {
        const encoder = new TextEncoder();

        const readable = new ReadableStream({
          async start(controller) {
            console.log(`🎬 Starting yt-dlp download (${resolution}p): ${url}`);

            try {
              const downloader = new SimpleYouTubeDownloader(url, uploadDir);
              const info = await downloader.getVideoInfo();
              const sanitizedTitle = sanitizeFilename(info.title);
              const outputPath = path.join(uploadDir, `${sanitizedTitle}.%(ext)s`);

              const args = [
                "-f",
                `bestvideo[height=${resolution}]+bestaudio/best[height<=${resolution}]`,
                "--merge-output-format",
                "mp4",
                "-o",
                outputPath,
                "--newline",
                "--no-warnings",
                "--no-call-home",
                "--write-info-json",
                "--write-thumbnail",
                ...getCookiesArgs(),
                url,
              ];

              const proc = spawn("yt-dlp", args);
              let finalFilename = "";

              proc.stdout.on("data", (chunk) => {
                const line = chunk.toString();
                const match = line.match(/(\d+(?:\.\d+)?)%/);
                if (match) {
                  const percent = parseFloat(match[1]);
                  controller.enqueue(encoder.encode(`data: ${percent}\n\n`));
                }
              });

              proc.stderr.on("data", (chunk) => {
                const msg = chunk.toString();
                console.error("yt-dlp stderr:", msg);
                if (
                  msg.includes("Sign in") ||
                  msg.includes("Private") ||
                  msg.includes("HTTP Error 403") ||
                  msg.includes("age restricted")
                ) {
                  controller.enqueue(encoder.encode(`data: error|auth\n\n`));
                  controller.close();
                }
              });

              proc.on("close", async (code) => {
                if (code === 0) {
                  try {
                    const files = await fs.promises.readdir(uploadDir);
                    const mp4s = files
                      .filter((f) => f.endsWith(".mp4") && f.includes(sanitizedTitle))
                      .map((f) => ({
                        name: f,
                        time: fs.statSync(path.join(uploadDir, f)).mtime.getTime(),
                      }))
                      .sort((a, b) => b.time - a.time);

                    const newest = mp4s[0];
                    if (newest) {
                      finalFilename = newest.name;
                      const filePath = path.join(uploadDir, finalFilename);
                      const stats = await fs.promises.stat(filePath);

                      await db.query(
                        "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
                        [
                          finalFilename,
                          filePath,
                          stats.size,
                          folderId,
                          session.user.id,
                          "youtube",
                        ]
                      );

                      controller.enqueue(encoder.encode(`data: complete|${finalFilename}\n\n`));
                      console.log(`✅ Download complete: ${finalFilename}`);
                    } else {
                      controller.enqueue(encoder.encode(`data: error|No file found\n\n`));
                    }
                  } catch (err) {
                    console.error("💥 Finalization error:", err);
                    controller.enqueue(
                      encoder.encode(`data: error|${err instanceof Error ? err.message : "Unknown error"}\n\n`)
                    );
                  } finally {
                    controller.close();
                  }
                } else {
                  controller.enqueue(encoder.encode(`data: error|Download failed (${code})\n\n`));
                  controller.close();
                }
              });

              proc.on("error", (error) => {
                console.error("💥 Process error:", error);
                controller.enqueue(encoder.encode(`data: error|${error.message}\n\n`));
                controller.close();
              });
            } catch (error) {
              console.error("💥 Download setup error:", error);
              controller.enqueue(
                encoder.encode(`data: error|${error instanceof Error ? error.message : "Setup failed"}\n\n`)
              );
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

      // Fallback - return metadata only
      try {
        const downloader = new SimpleYouTubeDownloader(url, uploadDir);
        const info = await downloader.getVideoInfo();
        return NextResponse.json({ info });
      } catch (error: any) {
        console.error("💥 Info fetch failed:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                         Case 2: Normal File Upload                     */
    /* ---------------------------------------------------------------------- */
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
    const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(uploadDir, filename);
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
        console.log(`✅ File upload complete: ${filename} (${stats.size} bytes)`);
      }

      return NextResponse.json({ success: true, start, end, total });
    } catch (error) {
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath).catch(() => {});
      throw error;
    }
  } catch (err: any) {
    console.error("💥 Upload error:", err);
    return NextResponse.json({ error: `Unexpected failure: ${err.message}` }, { status: 500 });
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
      return NextResponse.json({ error: "Missing ?url parameter" }, { status: 400 });

    const downloader = new SimpleYouTubeDownloader(url, "");
    const info = await downloader.getVideoInfo();

    return NextResponse.json({
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      author: info.uploader,
      viewCount: info.view_count,
      uploadDate: info.upload_date,
      description: info.description,
    });
  } catch (error: any) {
    console.error("💥 Video info fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
