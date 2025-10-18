import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ correct path
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/db/getQuizzes
 * Returns all quizzes and their questions belonging to the logged-in user.
 */
export async function GET(_req: NextRequest) {
  // 🔒 Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // ✅ Fetch quizzes for this user only
    const [quizRows] = await db.query<RowDataPacket[]>(
      `
      SELECT id, name, description, generation_status, num_questions
      FROM quizzes
      WHERE user_id = ?
      ORDER BY id DESC
      `,
      [userId]
    );

    if (quizRows.length === 0) {
      return NextResponse.json([]); // Return empty list if none
    }

    // ✅ Fetch all questions for these quizzes
    const quizIds = quizRows.map((q) => q.id);
    const placeholders = quizIds.map(() => "?").join(", ");

    const [questionRows] = await db.query<RowDataPacket[]>(
      `
      SELECT id, quiz_id, question, option_a, option_b, option_c, option_d, correct_answer
      FROM quiz_questions
      WHERE quiz_id IN (${placeholders})
      `,
      quizIds
    );

    // ✅ Combine quizzes with their respective questions
    const quizzes = quizRows.map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      generation_status: quiz.generation_status,
      num_questions: quiz.num_questions,
      questions: questionRows
        .filter((q) => q.quiz_id === quiz.id)
        .map((q) => ({
          id: q.id,
          question: q.question,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          correct: q.correct_answer,
        })),
    }));

    return NextResponse.json(quizzes);
  } catch (err: any) {
    console.error("❌ Error fetching quizzes:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
