import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { pipeline } from "stream";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { spawn } from "child_process";

const pump = promisify(pipeline);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const folder = searchParams.get("folder");

    if (!url) {
      return new Response("Missing YouTube URL", { status: 400 });
    }

    const encoder = new TextEncoder();
    const uploadDir = "/shared-files";
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const outputTemplate = path.join(uploadDir, "%(title)s.%(ext)s");

    const args = [
      url,
      "--output", outputTemplate,
      "--format", "bestvideo+bestaudio/best",
      "--merge-output-format", "mp4",
      "--remux-video", "mp4",
      "--audio-format", "aac",
      "--audio-quality", "192K",
      "--postprocessor-args", "ffmpeg:-c:v copy -c:a aac -b:a 192k",
      "--prefer-ffmpeg",
      "--ffmpeg-location", "/usr/bin/ffmpeg",
      "--no-playlist",
      "--no-warnings",
      "--progress",
      "--newline",
      "--console-title",
      "--verbose"
    ];

    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn("yt-dlp", args);

        proc.stderr.on("data", (data) => {
          const text = data.toString();
          const match = text.match(/\[download\]\s+([\d.]+)%/);
          if (match) {
            const percent = parseFloat(match[1]);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ percent })}\n\n`)
            );
          }
        });

        proc.on("error", (err) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "error", error: err.message })}\n\n`
            )
          );
          controller.close();
        });

        proc.on("close", async (code) => {
          try {
            if (code !== 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ status: "error", error: "Download failed." })}\n\n`
                )
              );
              controller.close();
              return;
            }

            const files = await fs.promises.readdir(uploadDir);
            const latestFile = files
              .map((f) => ({
                name: f,
                time: fs.statSync(path.join(uploadDir, f)).mtime.getTime(),
              }))
              .sort((a, b) => b.time - a.time)[0];

            if (latestFile) {
              const filePath = path.join(uploadDir, latestFile.name);
              const stats = await fs.promises.stat(filePath);
              await db.query(
                "INSERT INTO files (name, path, size, folder_id, user_id) VALUES (?, ?, ?, ?, ?)",
                [latestFile.name, filePath, stats.size, folder || null, "system"] // adjust user_id as needed
              );
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ status: "complete" })}\n\n`
              )
            );
            controller.close();
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ status: "error", error: err.message })}\n\n`
              )
            );
            controller.close();
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("💥 GET download error:", err);
    return new Response(err.message || "Operation failed", { status: 500 });
  }
}

