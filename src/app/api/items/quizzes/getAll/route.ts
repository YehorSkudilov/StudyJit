import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";

/**
 * GET /api/db/getQuizzes?folder=<id or root>
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder");

  try {
    console.log("🧩 Fetching quizzes for folder:", folder);

    let quizRows: RowDataPacket[] = [];

    if (folder === "root" || !folder) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT id, name, description, generation_status, num_questions, folder_id
         FROM quizzes
         WHERE user_id = ? AND folder_id IS NULL
         ORDER BY id DESC`,
        [userId]
      );
      quizRows = rows;
    } else {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT id, name, description, generation_status, num_questions, folder_id
         FROM quizzes
         WHERE user_id = ? AND folder_id = ?
         ORDER BY id DESC`,
        [userId, folder]
      );
      quizRows = rows;
    }

    if (quizRows.length === 0) {
      console.log("🟡 No quizzes found");
      return NextResponse.json([]);
    }

    const quizIds = quizRows.map((q) => q.id);
    const placeholders = quizIds.map(() => "?").join(", ");

    const [questionRows] = await db.query<RowDataPacket[]>(
      `SELECT id, quiz_id, question, option_a, option_b, option_c, option_d, correct_answer
       FROM quiz_questions
       WHERE quiz_id IN (${placeholders})`,
      quizIds
    );

    const quizzes = quizRows.map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      generation_status: quiz.generation_status,
      num_questions: quiz.num_questions,
      folder_id: quiz.folder_id,
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
    console.error("❌ GetQuizzes error:", err.sqlMessage || err.message);
    return NextResponse.json(
      { error: err.sqlMessage || err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
