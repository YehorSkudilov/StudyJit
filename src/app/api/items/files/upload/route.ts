import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { spawn } from "child_process";
import youtubedl from "youtube-dl-exec"; // ⬅️ use yt-dlp via wrapper

const pump = promisify(pipeline);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

/* -------------------------------------------------------------------------- */
/*                                  MAIN POST                                 */
/* -------------------------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    // your main logic here
  } catch (err: any) {
    console.error("❌ Backend Error:", err);

    // Detect known error types
    if (err.code === "ENOENT") {
      return NextResponse.json(
        { error: "File not found", details: err.message },
        { status: 404 }
      );
    }

    if (err.name === "ValidationError") {
      return NextResponse.json(
        { error: "Invalid input", details: err.message },
        { status: 400 }
      );
    }

    // Fallback for unexpected errors
    return NextResponse.json(
      {
        error: "Internal server error",
        message: err.message ?? "Unknown error",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                      helper: find the most recent mp4                      */
/* -------------------------------------------------------------------------- */
async function pickMostRecentFile(dir: string, ext: string) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(ext))
      .map(async (d) => {
        const fullPath = path.join(dir, d.name);
        const s = await fs.promises.stat(fullPath);
        return { name: d.name, fullPath, mtimeMs: s.mtimeMs };
      })
  );
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0];
}

/* -------------------------------------------------------------------------- */
/*                (Only needed if you keep manual ffmpeg merges)              */
/* -------------------------------------------------------------------------- */
async function mergeWithFFmpeg(videoPath: string, audioPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      outputPath,
    ]);
    ffmpeg.stderr.on("data", (d) => process.stdout.write(d));
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg failed ${code}`))));
  });
}
