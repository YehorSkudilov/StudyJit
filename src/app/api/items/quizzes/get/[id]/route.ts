import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/db/getQuiz/[id]
 * Fetch a single quiz with its details and questions.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quizId = Number(id);

  // 🔒 Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    if (isNaN(quizId)) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 });
    }

    // ✅ Fetch quiz only if it belongs to this user
    const [quizRows] = await db.query<RowDataPacket[]>(
      `
      SELECT 
        id,
        name,
        description,
        prompt,
        num_questions,
        generation_status,
        last_score
      FROM quizzes
      WHERE id = ? AND user_id = ?
      `,
      [quizId, userId]
    );

    if (quizRows.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const quiz = quizRows[0];

    // ✅ Fetch related questions
    const [questionRows] = await db.query<RowDataPacket[]>(
      `
      SELECT id, question, option_a, option_b, option_c, option_d, correct_answer
      FROM quiz_questions
      WHERE quiz_id = ?
      `,
      [quizId]
    );

    quiz.questions = questionRows.map((q) => ({
      id: q.id,
      question: q.question,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correct: q.correct_answer,
    }));

    return NextResponse.json(quiz);
  } catch (err: any) {
    console.error("❌ Error fetching quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
