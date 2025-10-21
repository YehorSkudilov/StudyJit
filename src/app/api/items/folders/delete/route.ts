import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const { ids, context } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ error: "No folder IDs provided" }, { status: 400 });
    if (!["quizzes", "files"].includes(context))
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });

    const allFolderIds = [...ids.map(String)];
    let i = 0;
    while (i < allFolderIds.length) {
      const currentId = allFolderIds[i];
      const [children]: any[] = await db.query(
        "SELECT id FROM folders WHERE parent_id = ? AND context = ? AND user_id = ?",
        [currentId, context, userId]
      );
      for (const child of children) {
        const childId = String(child.id);
        if (!allFolderIds.includes(childId)) allFolderIds.push(childId);
      }
      i++;
    }

    const placeholders = allFolderIds.map(() => "?").join(",");
    console.log(`🗑️ Deleting ${context} folders: ${allFolderIds.join(", ")}`);

    if (context === "quizzes") {
      await db.query(
        `DELETE qq FROM quiz_questions qq
         JOIN quizzes q ON qq.quiz_id = q.id
         WHERE q.folder_id IN (${placeholders}) AND q.user_id = ?`,
        [...allFolderIds, userId]
      );
      await db.query(
        `DELETE FROM quizzes WHERE folder_id IN (${placeholders}) AND user_id = ?`,
        [...allFolderIds, userId]
      );
    } else if (context === "files") {
      await db.query(
        `DELETE FROM files WHERE folder_id IN (${placeholders}) AND user_id = ?`,
        [...allFolderIds, userId]
      );
    }

    const [result]: any = await db.query(
      `DELETE FROM folders WHERE id IN (${placeholders}) AND context = ? AND user_id = ?`,
      [...allFolderIds, context, userId]
    );

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  } catch (err: any) {
    console.error("❌ Folder DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
