import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ use your correct path
import db from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // 🔒 Require authentication
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No quiz IDs provided" }, { status: 400 });
    }

    // ✅ Build placeholders like (?, ?, ?)
    const placeholders = ids.map(() => "?").join(", ");

    // ✅ Delete quiz questions for owned quizzes only
    await db.query(
      `
      DELETE qq FROM quiz_questions qq
      JOIN quizzes q ON qq.quiz_id = q.id
      WHERE q.id IN (${placeholders}) AND q.user_id = ?
      `,
      [...ids, userId]
    );

    // ✅ Delete owned quizzes
    const [result] = await db.execute<ResultSetHeader>(
      `DELETE FROM quizzes WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, userId]
    );

    console.log(`🗑️ User ${userId} deleted ${result.affectedRows} quiz(es)`);

    return NextResponse.json({
      success: true,
      deleted: result.affectedRows,
    });
  } catch (err: any) {
    console.error("❌ Error deleting quizzes:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
