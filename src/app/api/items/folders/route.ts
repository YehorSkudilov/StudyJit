import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

/* ---------------------- GET Folders ---------------------- */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const parent = searchParams.get("parent");
    const context = searchParams.get("context") || "quizzes";

    if (!["quizzes", "files"].includes(context))
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });

    const itemTable = context === "quizzes" ? "quizzes" : "files";

    let query: string;
    let params: any[];

    if (parent === "root" || parent === null) {
      query = `
        SELECT 
          f.id, 
          f.name, 
          f.parent_id,
          (
            SELECT COUNT(*) FROM ${itemTable} i WHERE i.folder_id = f.id AND i.user_id = ?
          ) + (
            SELECT COUNT(*) FROM folders sf WHERE sf.parent_id = f.id AND sf.context = ? AND sf.user_id = ?
          ) AS itemCount
        FROM folders f
        WHERE f.context = ? AND f.parent_id IS NULL AND f.user_id = ?
      `;
      params = [userId, context, userId, context, userId];
    } else {
      query = `
        SELECT 
          f.id, 
          f.name, 
          f.parent_id,
          (
            SELECT COUNT(*) FROM ${itemTable} i WHERE i.folder_id = f.id AND i.user_id = ?
          ) + (
            SELECT COUNT(*) FROM folders sf WHERE sf.parent_id = f.id AND sf.context = ? AND sf.user_id = ?
          ) AS itemCount
        FROM folders f
        WHERE f.context = ? AND f.parent_id = ? AND f.user_id = ?
      `;
      params = [userId, context, userId, context, Number(parent), userId];
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const { name, parent_id = null, context = "quizzes" } = await req.json();

    if (!["quizzes", "files"].includes(context))
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });

    if (!name?.trim())
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });

    // Optional: prevent duplicates in same folder
    const [exists]: any = await db.query(
      `SELECT id FROM folders WHERE user_id = ? AND context = ? AND name = ? AND IFNULL(parent_id, 'root') = IFNULL(?, 'root')`,
      [userId, context, name.trim(), parent_id]
    );
    if (exists.length > 0)
      return NextResponse.json(
        { error: "A folder with this name already exists here" },
        { status: 409 }
      );

    await db.query(
      "INSERT INTO folders (user_id, name, parent_id, context) VALUES (?, ?, ?, ?)",
      [userId, name.trim(), parent_id, context]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Folder POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
