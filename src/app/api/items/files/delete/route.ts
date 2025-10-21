import { NextResponse } from "next/server";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

/* -------------------------------------------------------------------------- */
/*                        DELETE FILES (POST /api/items/files/delete)         */
/* -------------------------------------------------------------------------- */
export async function POST(request: Request) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No file IDs provided" }, { status: 400 });
    }

    // 🔹 Get file paths before deletion
    const placeholders = ids.map(() => "?").join(",");
    const [rows]: any[] = await db.query(
      `SELECT id, name, path FROM files WHERE id IN (${placeholders})`,
      ids
    );

    // 🔹 Delete records from database
    await db.query(`DELETE FROM files WHERE id IN (${placeholders})`, ids);

    // 🔹 Delete physical files from disk
    for (const row of rows) {
      try {
        const filePath = row.path
          ? row.path
          : path.join("/shared-files", row.name); // fallback to shared volume
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`🗑️ Deleted file: ${filePath}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to delete file ${row.name}:`, err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ File delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
