import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

/**
 * POST /api/db/createQuiz
 * Creates a new quiz entry or adds new questions to an existing quiz.
 *
 * Expected JSON body:
 * {
 *   "quizName": "Math 101 Quiz",
 *   "description": "Basic algebra and arithmetic",
 *   "questions": [
 *     { "question": "What is 2+2?", "options": ["3","4","5","6"], "correct": "4" }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quizName, description, questions } = body;

    if (!quizName) {
      return NextResponse.json({ error: "Quiz name is required" }, { status: 400 });
    }

    const db = await getConnection();

    // ✅ Create or find quiz
    const [quizResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO quizzes (name, description)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [quizName, description || null]
    );

    // Get quizId (inserted or existing)
    let quizId = quizResult.insertId;
    if (!quizId) {
      const [rows] = await db.query<RowDataPacket[]>(`SELECT id FROM quizzes WHERE name = ?`, [quizName]);
      quizId = rows.length ? rows[0].id : null;
    }

    if (!quizId) {
      await db.end();
      return NextResponse.json({ error: "Failed to create or find quiz" }, { status: 500 });
    }

    // ✅ If questions are provided, append them without deleting existing ones
    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const [a, b, c, d] = q.options || [];
        await db.execute(
          `INSERT INTO quiz_questions 
             (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [quizId, q.question, a, b, c, d, q.correct]
        );
      }
    }

    await db.end();

    return NextResponse.json({
      success: true,
      quizId,
      message:
        Array.isArray(questions) && questions.length > 0
          ? `Quiz "${quizName}" created and ${questions.length} question(s) added.`
          : `Empty quiz "${quizName}" created successfully.`,
    });
  } catch (err: any) {
    console.error("❌ Error creating quiz:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
