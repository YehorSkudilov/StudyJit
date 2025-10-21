import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type ContextParam =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }; // ✅ for Next 15.5+

export async function PATCH(request: NextRequest, context: ContextParam) {
  try {
    // 🔧 unwrap params (Next.js can wrap in a Promise)
    const params = await (context.params instanceof Promise
      ? context.params
      : Promise.resolve(context.params));

    const { id } = params;
    const { parent_id, context: ctx } = await request.json();

    const contextType = ctx === "files" ? "files" : "quizzes"; // ✅ defaults safely

    console.log(`📦 Moving ${contextType} folder: ${id} → parent: ${parent_id}`);

    const folderId = Number(id);
    const parentId = parent_id ? Number(parent_id) : null;

    // ✅ Input validation
    if (isNaN(folderId))
      return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });

    if (folderId === parentId)
      return NextResponse.json(
        { error: "Cannot move a folder into itself" },
        { status: 400 }
      );

    // ✅ Perform scoped update
    const [result]: any = await db.query(
      "UPDATE folders SET parent_id = ? WHERE id = ? AND context = ?",
      [parentId, folderId, contextType]
    );

    if (!result || result.affectedRows === 0)
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    console.log(`✅ Folder ${folderId} moved successfully.`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Folder move error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
