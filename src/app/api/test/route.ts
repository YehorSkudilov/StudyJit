import { NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url)
      return NextResponse.json({ error: "Missing YouTube URL" }, { status: 400 });

    const tempDir = path.join(process.cwd(), "downloads");
    await fs.promises.mkdir(tempDir, { recursive: true });

    const outputTemplate = path.join(tempDir, "%(title)s.%(ext)s");

    // ✅ add --prefer-ffmpeg to ensure yt-dlp merges video+audio using ffmpeg
    const args = [
      url,
      "--output", outputTemplate,
      "--format", "bestvideo+bestaudio/best",
      "--merge-output-format", "mp4",
      "--prefer-ffmpeg",             // <--- 🔥 ensures audio+video merged
      "--audio-quality", "0",        // <--- 🔊 keep best audio
      "--audio-format", "mp3",       // (optional) keep MP3 audio when merging
      "--restrict-filenames",
      "--no-playlist",
      "--add-header", "referer:https://www.youtube.com/",
      "--add-header", "accept-language:en-US,en;q=0.9",
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
      "--geo-bypass",
      "--no-check-certificate",
      "--quiet",
    ];

    await new Promise((resolve, reject) => {
      execFile("yt-dlp", args, (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message);
        resolve(stdout);
      });
    });

    return NextResponse.json({
      message: "✅ Video downloaded successfully (with audio)",
      folder: tempDir,
    });
  } catch (err: any) {
    console.error("❌ Download error:", err);
    return NextResponse.json({ error: err.toString() }, { status: 500 });
  }
}
