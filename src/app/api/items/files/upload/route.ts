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

/* -------------------------------------------------------------------------- */
/*                            YouTube Info Fetcher                            */
/* -------------------------------------------------------------------------- */

class SimpleYouTubeDownloader {
  constructor(private url: string, private uploadDir: string) {}

  async getVideoInfo() {
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
            const info = JSON.parse(data);
            console.log(`✅ Got info: ${info.title}`);
            resolve(info);
          } catch {
            reject(new Error("Failed to parse yt-dlp JSON output"));
          }
        } else {
          console.error("❌ yt-dlp info error:", error);
          if (error.includes("Sign in"))
            reject(
              new Error(
                "This video is age-restricted or private. Add cookies.txt for authenticated downloads."
              )
            );
          else reject(new Error("Cannot access video: " + error));
        }
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
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const urlHeader = req.headers.get("x-url");
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
      const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

      // Stream progress via SSE if client requests it
      if (req.headers.get("accept") === "text/event-stream") {
        const encoder = new TextEncoder();

        const readable = new ReadableStream({
          start(controller) {
            console.log(`🎬 Starting yt-dlp download: ${url}`);
            const outputPath = path.join(uploadDir, "%(title)s.%(ext)s");

            const args = [
              "-f",
              "bestvideo+bestaudio/best",
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
              if (
                msg.includes("Sign in") ||
                msg.includes("Private") ||
                msg.includes("HTTP Error 403")
              ) {
                controller.enqueue(
                  encoder.encode(`data: error|auth\n\n`)
                );
              }
              console.error("yt-dlp:", msg);
            });

            proc.on("close", async (code) => {
              if (code === 0) {
                try {
                  const files = await fs.promises.readdir(uploadDir);
                  const mp4s = files
                    .filter((f) => f.endsWith(".mp4"))
                    .map((f) => ({
                      name: f,
                      time: fs.statSync(path.join(uploadDir, f)).mtime.getTime(),
                    }))
                    .sort((a, b) => b.time - a.time);

                  const newest = mp4s[0];
                  if (newest) {
                    const filePath = path.join(uploadDir, newest.name);
                    const stats = await fs.promises.stat(filePath);

                    await db.query(
                      "INSERT INTO files (name, path, size, folder_id, user_id, type) VALUES (?, ?, ?, ?, ?, ?)",
                      [
                        newest.name,
                        filePath,
                        stats.size,
                        folderId,
                        session.user.id,
                        "youtube",
                      ]
                    );

                    controller.enqueue(encoder.encode(`data: complete\n\n`));
                    console.log(`✅ Download complete: ${newest.name}`);
                  } else {
                    controller.enqueue(encoder.encode(`data: error\n\n`));
                  }
                } catch (err) {
                  console.error("💥 Finalization error:", err);
                  controller.enqueue(encoder.encode(`data: error\n\n`));
                } finally {
                  controller.close();
                }
              } else {
                controller.enqueue(encoder.encode(`data: error\n\n`));
                controller.close();
              }
            });
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

      // Fallback (non-SSE)
      try {
        const downloader = new SimpleYouTubeDownloader(url, uploadDir);
        const info: any = await downloader.getVideoInfo();
        return NextResponse.json({ info });
      } catch (error: any) {
        console.error("💥 Info fetch failed:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                         Case 2: Normal File Upload                     */
    /* ---------------------------------------------------------------------- */
    if (!range || !filenameHeader)
      return NextResponse.json({ error: "Missing upload headers" }, { status: 400 });

    const match = range.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match)
      return NextResponse.json({ error: "Invalid Content-Range" }, { status: 400 });

    const [, startStr, endStr, totalStr] = match;
    const start = parseInt(startStr);
    const end = parseInt(endStr);
    const total = parseInt(totalStr);
    const filename = decodeURIComponent(filenameHeader);
    const folderId = folderHeader && folderHeader !== "root" ? folderHeader : null;

    const filePath = path.join(uploadDir, filename);
    const flags = start === 0 ? "w" : "a";

    const body = req.body as unknown as NodeJS.ReadableStream;
    const fileStream = fs.createWriteStream(filePath, { flags });
    await pump(body, fileStream);

    // Only insert after last chunk
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
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url)
      return NextResponse.json({ error: "Missing ?url parameter" }, { status: 400 });

    const downloader = new SimpleYouTubeDownloader(url, "");
    const info: any = await downloader.getVideoInfo();

    return NextResponse.json({
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      author: info.uploader,
      viewCount: info.view_count,
    });
  } catch (error: any) {
    console.error("💥 Video info fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
