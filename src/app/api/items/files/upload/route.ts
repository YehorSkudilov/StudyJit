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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";

    /* ---------------------------------------------------------------------- */
    /* 🧩 CASE 1: YouTube Download (SSE Streaming)                            */
    /* ---------------------------------------------------------------------- */
    if (contentType.includes("application/json")) {
      const { url, folder } = await req.json();
      if (!url)
        return NextResponse.json({ error: "Missing YouTube URL" }, { status: 400 });

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
        "--verbose",
      ];

      // 🔥 Use TransformStream to allow immediate flushing (no buffering)
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      const proc = spawn("yt-dlp", args);

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        const match = text.match(/\[download\]\s+([\d.]+)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          writer.write(encoder.encode(`data: ${JSON.stringify({ percent })}\n\n`));
        }
      });

      proc.on("error", (err) => {
        writer.write(
          encoder.encode(`data: ${JSON.stringify({ status: "error", error: err.message })}\n\n`)
        );
        writer.close();
      });

      proc.on("close", async (code) => {
        try {
          if (code !== 0) {
            writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ status: "error", error: "Download failed" })}\n\n`
              )
            );
            writer.close();
            return;
          }

          // ✅ Find newest downloaded file
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
            const folderId = folder && folder !== "root" ? folder : null;

            await db.query(
              "INSERT INTO files (name, path, size, folder_id, user_id) VALUES (?, ?, ?, ?, ?)",
              [latestFile.name, filePath, stats.size, folderId, session.user.id]
            );
          }

          writer.write(encoder.encode(`data: ${JSON.stringify({ status: "complete" })}\n\n`));
          writer.close();
        } catch (err: any) {
          writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ status: "error", error: err.message })}\n\n`
            )
          );
          writer.close();
        }
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    /* ---------------------------------------------------------------------- */
    /* 📦 CASE 2: Chunked File Upload (Standard Upload)                       */
    /* ---------------------------------------------------------------------- */
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");
    const folderHeader = req.headers.get("x-folder");

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

    const uploadDir = "/shared-files";
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    const flags = start === 0 ? "w" : "a";

    if (!req.body)
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });

    const fileStream = fs.createWriteStream(filePath, { flags });
    await pump(req.body as any, fileStream);

    if (end + 1 >= total) {
      await db.query(
        "INSERT INTO files (name, path, size, folder_id, user_id) VALUES (?, ?, ?, ?, ?)",
        [filename, filePath, total, folderId, session.user.id]
      );
      console.log(`✅ Upload completed: ${filename} (${total} bytes)`);
    }

    return NextResponse.json({ success: true, start, end, total, folderId });
  } catch (err: any) {
    console.error("💥 Upload/Download error:", err);
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}
