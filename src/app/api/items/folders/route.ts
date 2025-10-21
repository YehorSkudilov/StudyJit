import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

/* ---------------------- GET Folders ---------------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parent = searchParams.get("parent");
    const context = searchParams.get("context") || "quizzes";

    if (!["quizzes", "files"].includes(context)) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    console.log(`📂 Fetching ${context} folders for parent:`, parent);

    const itemTable = context === "quizzes" ? "quizzes" : "files";

    let query: string;
    let params: any[] = [];

    if (parent === "root" || parent === null) {
      query = `
        SELECT 
          f.id, 
          f.name, 
          f.parent_id,
          (
            SELECT COUNT(*) FROM ${itemTable} i WHERE i.folder_id = f.id
          ) + (
            SELECT COUNT(*) FROM folders sf WHERE sf.parent_id = f.id AND sf.context = ?
          ) AS itemCount
        FROM folders f
        WHERE f.context = ? AND f.parent_id IS NULL
      `;
      params = [context, context];
    } else {
      query = `
        SELECT 
          f.id, 
          f.name, 
          f.parent_id,
          (
            SELECT COUNT(*) FROM ${itemTable} i WHERE i.folder_id = f.id
          ) + (
            SELECT COUNT(*) FROM folders sf WHERE sf.parent_id = f.id AND sf.context = ?
          ) AS itemCount
        FROM folders f
        WHERE f.context = ? AND f.parent_id = ?
      `;
      params = [context, context, Number(parent)];
    }

    const [rows] = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ Folder GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ---------------------- POST Create Folder ---------------------- */
export async function POST(req: NextRequest) {
  try {
    const { name, parent_id = null, user_id = 1, context = "quizzes" } = await req.json();

    if (!["quizzes", "files"].includes(context)) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    }

    await db.query(
      "INSERT INTO folders (user_id, name, parent_id, context) VALUES (?, ?, ?, ?)",
      [user_id, name, parent_id, context]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Folder POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
