import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/db/getQuizzes
 * Retrieves all quizzes with their questions.
 *
 * Example response:
 * [
 *   {
 *     id: 1,
 *     name: "Math 101 Quiz",
 *     description: "Basic algebra and arithmetic",
 *     questions: [
 *       {
 *         id: 5,
 *         question: "What is 2+2?",
 *         options: ["3", "4", "5", "6"],
 *         correct: "4"
 *       }
 *     ]
 *   }
 * ]
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getConnection();

    // ✅ Get all quizzes
    const [quizRows] = await db.query<RowDataPacket[]>(
      `SELECT id, name, description FROM quizzes ORDER BY id DESC`
    );

    // ✅ Get all questions
    const [questionRows] = await db.query<RowDataPacket[]>(
      `SELECT id, quiz_id, question, option_a, option_b, option_c, option_d, correct_answer
       FROM quiz_questions`
    );

    // ✅ Combine quizzes with their questions
    const quizzes = quizRows.map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      questions: questionRows
        .filter((q) => q.quiz_id === quiz.id)
        .map((q) => ({
          id: q.id,
          question: q.question,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          correct: q.correct_answer,
        })),
    }));

    await db.end();

    return NextResponse.json(quizzes);
  } catch (err: any) {
    console.error("❌ Error fetching quizzes:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
