import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = "/shared-files"; // ✅ Docker shared volume

    const db = await getConnection();

    // 1️⃣ Insert placeholder row to get the new ID
    const [result]: any = await db.query(
      `INSERT INTO files (name, size, mime_type, path) VALUES (?, ?, ?, '')`,
      [file.name, buffer.length, file.type]
    );
    const fileId = result.insertId;

    // 2️⃣ Build new unique path using the ID (e.g. /shared-files/42.pdf)
    const ext = path.extname(file.name) || "";
    const safeFileName = `${fileId}${ext}`;
    const filePath = path.join(uploadDir, safeFileName);

    // 3️⃣ Save file to disk
    await fs.promises.writeFile(filePath, buffer);

    // 4️⃣ Update DB record with the final path
    await db.query(`UPDATE files SET path = ? WHERE id = ?`, [filePath, fileId]);
    await db.end();

    console.log(`✅ Uploaded file saved as: ${filePath}`);

    return NextResponse.json({
      success: true,
      id: fileId,
      path: filePath,
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
