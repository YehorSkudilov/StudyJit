import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import fs from "fs/promises";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ Next 15 expects a Promise here
) {
  const { id } = await context.params;

  try {
    const db = await getConnection();
    const [rows]: any = await db.query("SELECT path FROM files WHERE id = ?", [
      id,
    ]);

    if (!rows.length) {
      await db.end();
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filePath = rows[0].path;

    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted file: ${filePath}`);
    } catch {
      console.warn(`⚠️ File already missing on disk: ${filePath}`);
    }

    await db.query("DELETE FROM files WHERE id = ?", [id]);
    await db.end();

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("❌ Delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
