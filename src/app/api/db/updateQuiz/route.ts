import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ make sure path matches your structure
import db from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function PATCH(req: NextRequest) {
  try {
    // 🔒 Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id, name, description, prompt, numQuestions } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 });
    }

    // ✅ Check quiz ownership
    const [quizRows]: any = await db.query(
      "SELECT id FROM quizzes WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (quizRows.length === 0) {
      return NextResponse.json(
        { error: "Quiz not found or not owned by this user" },
        { status: 403 }
      );
    }

    // ✅ Perform the update using the shared pool
    const [result] = await db.execute<ResultSetHeader>(
      `
      UPDATE quizzes
      SET name = ?, description = ?, prompt = ?, num_questions = ?
      WHERE id = ?
      `,
      [name || "", description || "", prompt || "", numQuestions || 10, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    console.log(`✅ User #${userId} updated quiz #${id}`);

    return NextResponse.json({
      success: true,
      message: "Quiz updated successfully",
    });
  } catch (err: any) {
    console.error("❌ Error updating quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
