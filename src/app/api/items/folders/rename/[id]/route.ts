import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

type ContextParam =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }; // ✅ supports Next 15.5 +

export async function PATCH(request: NextRequest, context: ContextParam) {
  try {
    // 🔧 unwrap params (Next.js 15.5 can wrap them in a Promise)
    const params =
      context.params instanceof Promise
        ? await context.params
        : context.params;

    const { id } = params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const { name, context: ctx } = await request.json();
    const contextType = ctx === "files" ? "files" : "quizzes";

    if (!name?.trim())
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });

    const folderId = Number(id);

    // ✅ rest of your rename logic …
    const [folder]: any = await db.query(
      `SELECT parent_id FROM folders WHERE id = ? AND user_id = ? AND context = ?`,
      [folderId, userId, contextType]
    );
    if (folder.length === 0)
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    const parentId = folder[0].parent_id ?? null;
    const [dup]: any = await db.query(
      `SELECT id FROM folders WHERE user_id = ? AND context = ? AND name = ?
       AND IFNULL(parent_id,'root') = IFNULL(?, 'root') AND id != ?`,
      [userId, contextType, name.trim(), parentId, folderId]
    );
    if (dup.length > 0)
      return NextResponse.json({ error: "Duplicate folder name" }, { status: 409 });

    await db.query(
      `UPDATE folders SET name = ? WHERE id = ? AND user_id = ? AND context = ?`,
      [name.trim(), folderId, userId, contextType]
    );

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (err: any) {
    console.error("❌ Folder rename error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
