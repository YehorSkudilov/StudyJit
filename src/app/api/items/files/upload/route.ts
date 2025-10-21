import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

// ✅ use Node.js stream pipeline
const pump = promisify(pipeline);

// ✅ force pure Node runtime (critical!)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "auto";
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  try {
    // ✅ ensure session check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ✅ validate custom headers
    const range = req.headers.get("content-range");
    const filenameHeader = req.headers.get("x-filename");
    if (!range || !filenameHeader)
      return NextResponse.json({ error: "Missing headers" }, { status: 400 });

    // ✅ parse "bytes start-end/total"
    const match = range.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match)
      return NextResponse.json({ error: "Invalid Content-Range header" }, { status: 400 });

    const [, startStr, endStr, totalStr] = match;
    const start = parseInt(startStr);
    const end = parseInt(endStr);
    const total = parseInt(totalStr);
    const filename = decodeURIComponent(filenameHeader);

    // ✅ ensure directory exists
    const uploadDir = "/shared-files";
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    const flags = start === 0 ? "w" : "a";

    // ✅ open write stream
    const fileStream = fs.createWriteStream(filePath, { flags });

    // ✅ ensure we have a streamable body (no FormData)
    if (!req.body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    // ✅ use pipeline to stream directly to disk
    await pump(req.body as any, fileStream);

    // ✅ if last chunk, finalize DB record
    if (end + 1 >= total) {
      await db.query(
        "INSERT INTO files (name, path, size, user_id) VALUES (?, ?, ?, ?)",
        [filename, filePath, total, session.user.id]
      );
      console.log(`✅ Upload completed: ${filename} (${total} bytes)`);
    }

    return NextResponse.json({ success: true, start, end, total });
  } catch (err: any) {
    console.error("💥 Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
