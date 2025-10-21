import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

/**
 * PATCH /api/items/folders/rename/[id]
 * Body: { name: string, context: "quizzes" | "files" }
 */
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    // 1️⃣ Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const folderId = Number(context.params.id);
    if (isNaN(folderId))
      return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });

    // 2️⃣ Parse request body
    const { name, context: ctx } = await req.json();
    const contextType = ctx === "files" ? "files" : "quizzes";

    if (!name?.trim())
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });

    // 3️⃣ Ensure folder exists & belongs to user
    const [folders]: any = await db.query(
      `SELECT id, parent_id FROM folders WHERE id = ? AND user_id = ? AND context = ?`,
      [folderId, userId, contextType]
    );
    if (folders.length === 0)
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    const parentId = folders[0].parent_id ?? null;

    // 4️⃣ Prevent duplicate names under same parent
    const [existing]: any = await db.query(
      `SELECT id FROM folders
       WHERE user_id = ? AND context = ? AND name = ? AND IFNULL(parent_id, 'root') = IFNULL(?, 'root') AND id != ?`,
      [userId, contextType, name.trim(), parentId, folderId]
    );
    if (existing.length > 0)
      return NextResponse.json(
        { error: "A folder with this name already exists here" },
        { status: 409 }
      );

    // 5️⃣ Perform rename
    await db.query(
      `UPDATE folders SET name = ? WHERE id = ? AND user_id = ? AND context = ?`,
      [name.trim(), folderId, userId, contextType]
    );

    console.log(`✏️ Folder ${folderId} renamed to '${name}'`);
    return NextResponse.json({ success: true, name });
  } catch (err: any) {
    console.error("❌ Folder rename error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
