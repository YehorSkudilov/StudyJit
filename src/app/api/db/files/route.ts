import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET() {
  try {
    const db = await getConnection();
    const [rows] = await db.query("SELECT * FROM files ORDER BY uploaded_at DESC");
    await db.end();
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ Fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
