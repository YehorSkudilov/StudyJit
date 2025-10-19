export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get the content type to verify it's multipart/form-data
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Invalid content type", details: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      console.error("❌ Failed to parse FormData:", err);
      return NextResponse.json(
        { error: "Bad FormData", details: err instanceof Error ? err.message : "Unknown error" },
        { status: 400 }
      );
    }

    const file = form.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "shared-files");
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, file.name);
    await fs.promises.writeFile(filePath, buffer);

    await db.query(
      "INSERT INTO files (name, size, path, user_id) VALUES (?, ?, ?, ?)",
      [file.name, file.size, filePath, session.user.id]
    );

    return NextResponse.json({ success: true, fileName: file.name });
  } catch (err: any) {
    console.error("❌ Upload failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}