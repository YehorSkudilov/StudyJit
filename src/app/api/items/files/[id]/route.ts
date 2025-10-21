import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ your correct path
import db from "@/lib/db";
import fs from "fs/promises";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ Next 15: params is async
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  // 🔒 Require user login
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // ✅ Fetch file and ensure ownership
    const [rows]: any = await db.query(
      "SELECT path, user_id FROM files WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = rows[0];
    if (file.user_id !== Number(userId)) {
      return NextResponse.json({ error: "Forbidden: Not your file" }, { status: 403 });
    }

    const filePath = file.path;

    // 🗑️ Try deleting from disk
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted file from disk: ${filePath}`);
    } catch {
      console.warn(`⚠️ File missing on disk: ${filePath}`);
    }

    // ✅ Remove DB record
    await db.query("DELETE FROM files WHERE id = ? AND user_id = ?", [id, userId]);

    console.log(`✅ User ${userId} deleted file #${id}`);

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("❌ File delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
