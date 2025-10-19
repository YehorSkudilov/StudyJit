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

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    // 🔸 Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 🔸 Ensure upload directory exists and is writable
    const uploadDir = path.join(process.cwd(), "shared-files");
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // 🔸 Write file to disk
    const filePath = path.join(uploadDir, file.name);
    await fs.promises.writeFile(filePath, buffer);

    // 🔸 Insert record into DB
    await db.query(
      "INSERT INTO files (name, size, path, user_id) VALUES (?, ?, ?, ?)",
      [file.name, file.size, filePath, session.user.id]
    );

    return NextResponse.json({ success: true, file: file.name });
  } catch (err: any) {
    console.error("❌ File upload failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
