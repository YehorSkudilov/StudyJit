import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ your auth options
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  // 🔒 Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const form = await req.formData();
    const file = form.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // ✅ Read the file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = "/shared-files"; // Docker shared volume
    await fs.promises.mkdir(uploadDir, { recursive: true }); // ensure dir exists

    // 1️⃣ Create placeholder entry
    const [result]: any = await db.query(
      `INSERT INTO files (name, size, mime_type, path, user_id) VALUES (?, ?, ?, '', ?)`,
      [file.name, buffer.length, file.type, userId]
    );

    const fileId = result.insertId;
    const ext = path.extname(file.name) || "";
    const safeFileName = `${fileId}${ext}`;
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
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
