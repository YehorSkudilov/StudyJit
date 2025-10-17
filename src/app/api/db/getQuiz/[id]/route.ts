import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/db/getQuiz/[id]
 * Fetches a single quiz by ID (with its questions).
 *
 * Example:
 *   /api/db/getQuiz/1
 *
 * Example response:
 * {
 *   "id": 1,
 *   "name": "Math 101 Quiz",
 *   "description": "Basic algebra and arithmetic",
 *   "questions": [
 *     {
 *       "id": 5,
 *       "question": "What is 2+2?",
 *       "options": ["3", "4", "5", "6"],
 *       "correct": "4"
 *     }
 *   ]
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // 👈 must await the promise now

  try {
    const quizId = Number(id);
    if (isNaN(quizId)) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 });
    }

    const db = await getConnection();

    const [quizRows] = await db.query<RowDataPacket[]>(
      `SELECT id, name, description FROM quizzes WHERE id = ?`,
      [quizId]
    );

    if (quizRows.length === 0) {
      await db.end();
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const quiz = quizRows[0];

    const [questionRows] = await db.query<RowDataPacket[]>(
      `SELECT id, question, option_a, option_b, option_c, option_d, correct_answer
       FROM quiz_questions WHERE quiz_id = ?`,
      [quizId]
    );

    quiz.questions = questionRows.map((q) => ({
      id: q.id,
      question: q.question,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correct: q.correct_answer,
    }));

    await db.end();

    return NextResponse.json(quiz);
  } catch (err: any) {
    console.error("❌ Error fetching quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

