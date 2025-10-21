import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const newFolderId = body.folder_id || null;
    await db.query("UPDATE files SET folder_id = ? WHERE id = ?", [newFolderId, id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ File move error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
