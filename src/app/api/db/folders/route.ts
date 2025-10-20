import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

/* GET /api/db/folders?path=root */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") || "root";
    const [rows] = await db.query("SELECT * FROM folders WHERE parent_path = ?", [path]);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ Folder GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* POST /api/db/folders */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, parent_path = "root", user_id = 1 } = body;

    await db.query(
      "INSERT INTO folders (name, parent_path, user_id) VALUES (?, ?, ?)",
      [name, parent_path, user_id]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Folder POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
