import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let fileId: number | null = null;

  try {
    const form = await req.formData();
    const file = form.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Check file size (1 GB limit)
    if (file.size > 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 1 GB limit" },
        { status: 400 }
      );
    }

    // Read the file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = "/shared-files";
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // 1️⃣ Create placeholder entry
    const [insertResult]: any = await db.query(
      `INSERT INTO files (name, size, mime_type, path, user_id) VALUES (?, ?, ?, '', ?)`,
      [file.name, buffer.length, file.type || "application/octet-stream", userId]
    );

    fileId = insertResult.insertId;
    
    // 🔒 Sanitize extension to prevent path traversal
    const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safeExt = ext.startsWith(".") ? ext : "";
    const safeFileName = `${fileId}${safeExt}`;
    const filePath = path.join(uploadDir, safeFileName);

    // 2️⃣ Save file to disk
    await fs.promises.writeFile(filePath, buffer);

    // 3️⃣ Update record with real path
    await db.query(`UPDATE files SET path = ? WHERE id = ? AND user_id = ?`, [
      filePath,
      fileId,
      userId,
    ]);

    console.log(`✅ User ${userId} uploaded file saved as: ${filePath}`);

    return NextResponse.json({
      success: true,
      id: fileId,
      path: filePath,
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    
    // 🧹 Cleanup: try to delete the database entry if file write failed
    if (fileId) {
      try {
        await db.query(`DELETE FROM files WHERE id = ? AND user_id = ?`, [
          fileId,
          userId,
        ]);
      } catch (cleanupErr) {
        console.error("Failed to cleanup DB entry:", cleanupErr);
      }
    }

    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}