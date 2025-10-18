import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

    // ✅ Ensure the quiz belongs to this user
    const [quizRows]: any = await db.query(
      "SELECT id FROM quizzes WHERE id = ? AND user_id = ?",
      [quizId, userId]
    );

    if (quizRows.length === 0) {
      return NextResponse.json(
        { error: "Quiz not found or not owned by this user" },
        { status: 403 }
      );
    }

    // ✅ Fetch files linked to this quiz
    const [rows]: any = await db.query(
      `
      SELECT f.id, f.name, f.path AS file_path
      FROM quiz_files qf
      JOIN files f ON qf.file_id = f.id
      WHERE qf.quiz_id = ?
      ORDER BY f.uploaded_at DESC
      `,
      [quizId]
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ Error fetching quiz files:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
