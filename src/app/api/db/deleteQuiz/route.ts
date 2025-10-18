import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No quiz IDs provided" }, { status: 400 });
    }

    const db = await getConnection();

    // ✅ Build dynamic placeholders like (?, ?, ?)
    const placeholders = ids.map(() => "?").join(", ");

    // ✅ Delete quiz questions first (foreign key safety)
    await db.query(`DELETE FROM quiz_questions WHERE quiz_id IN (${placeholders})`, ids);

    // ✅ Then delete the quizzes
    const [result] = await db.execute<ResultSetHeader>(
      `DELETE FROM quizzes WHERE id IN (${placeholders})`,
      ids
    );

    await db.end();

    return NextResponse.json({
      success: true,
      deleted: result.affectedRows,
    });
  } catch (err: any) {
    console.error("❌ Error deleting quizzes:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
