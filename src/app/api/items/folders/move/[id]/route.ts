import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

type ContextParam =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: ContextParam) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const params = await (context.params instanceof Promise
      ? context.params
      : Promise.resolve(context.params));
    const { id } = params;
    const { parent_id, context: ctx } = await request.json();

    const contextType = ctx === "files" ? "files" : "quizzes";
    const folderId = Number(id);
    const parentId = parent_id ? Number(parent_id) : null;

    if (isNaN(folderId))
      return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
    if (folderId === parentId)
      return NextResponse.json(
        { error: "Cannot move a folder into itself" },
        { status: 400 }
      );

    const [result]: any = await db.query(
      "UPDATE folders SET parent_id = ? WHERE id = ? AND context = ? AND user_id = ?",
      [parentId, folderId, contextType, userId]
    );

    if (!result || result.affectedRows === 0)
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    console.log(`✅ Folder ${folderId} moved successfully.`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Folder move error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
