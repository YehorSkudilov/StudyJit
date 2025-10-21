import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

/**
 * DELETE /api/items/folders/delete
 * Deletes one or more folders (and all their subfolders + related items)
 * Supports context: 'quizzes' | 'files'
 */
export async function POST(req: NextRequest) {
  try {
    const { ids, context, user_id = 1 } = await req.json();

    // ✅ Validate inputs
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ error: "No folder IDs provided" }, { status: 400 });

    if (!["quizzes", "files"].includes(context))
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });

    // ✅ Collect all descendant folders
    const allFolderIds = [...ids.map(String)];
    let i = 0;
    while (i < allFolderIds.length) {
      const currentId = allFolderIds[i];
      const [children]: any[] = await db.query(
        "SELECT id FROM folders WHERE parent_id = ? AND context = ? AND user_id = ?",
        [currentId, context, user_id]
      );
      for (const child of children) {
        const childId = String(child.id);
        if (!allFolderIds.includes(childId)) allFolderIds.push(childId);
      }
      i++;
    }

    // ✅ Prepare SQL placeholders
    const placeholders = allFolderIds.map(() => "?").join(",");
    console.log(`🗑️ Deleting ${context} folders: ${allFolderIds.join(", ")}`);

    if (context === "quizzes") {
      // 🧩 Delete related quiz data first
      await db.query(
        `DELETE qq FROM quiz_questions qq
         JOIN quizzes q ON qq.quiz_id = q.id
         WHERE q.folder_id IN (${placeholders}) AND q.user_id = ?`,
        [...allFolderIds, user_id]
      );

      await db.query(
        `DELETE FROM quizzes WHERE folder_id IN (${placeholders}) AND user_id = ?`,
        [...allFolderIds, user_id]
      );
    } else if (context === "files") {
      // 🧩 Delete related files for file folders
      await db.query(
        `DELETE FROM files WHERE folder_id IN (${placeholders}) AND user_id = ?`,
        [...allFolderIds, user_id]
      );
    }

    // ✅ Finally, delete the folders themselves
    const [result]: any = await db.query(
      `DELETE FROM folders WHERE id IN (${placeholders}) AND context = ? AND user_id = ?`,
      [...allFolderIds, context, user_id]
    );

    console.log(`✅ Deleted ${result.affectedRows} ${context} folders`);
    return NextResponse.json({ success: true, deleted: result.affectedRows });
  } catch (err: any) {
    console.error("❌ Folder DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
