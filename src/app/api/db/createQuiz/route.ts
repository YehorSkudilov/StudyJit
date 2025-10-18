import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quizName, description, questions } = body;

    if (!quizName) {
      return NextResponse.json({ error: "Quiz name is required" }, { status: 400 });
    }

    const db = await getConnection();

    // ✅ Create quiz with "never_generated" instead of "pending"
    const [quizResult] = await db.execute<ResultSetHeader>(
      `
      INSERT INTO quizzes (name, description, generation_status)
      VALUES (?, ?, 'never_generated')
      ON DUPLICATE KEY UPDATE
        description = VALUES(description)
      `,
      [quizName, description || null]
    );

    // ✅ Determine quizId
    let quizId = quizResult.insertId;
    if (!quizId) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT id FROM quizzes WHERE name = ?`,
        [quizName]
      );
      quizId = rows.length ? rows[0].id : null;
    }

    if (!quizId) {
      await db.end();
      return NextResponse.json({ error: "Failed to create or find quiz" }, { status: 500 });
    }

    // ✅ Insert provided questions (if any)
    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const [a, b, c, d] = q.options || [];
        await db.execute(
          `
          INSERT INTO quiz_questions
            (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [quizId, q.question, a, b, c, d, q.correct]
        );
      }
    }

    await db.end();

    return NextResponse.json({
      success: true,
      quizId,
      generation_status: "never_generated",
      message:
        Array.isArray(questions) && questions.length > 0
          ? `Quiz "${quizName}" created with ${questions.length} question(s) and status 'never_generated'.`
          : `Empty quiz "${quizName}" created successfully with status 'never_generated'.`,
    });
  } catch (err: any) {
    console.error("❌ Error creating quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
