import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, prompt, numQuestions } = body;

    if (!id) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 });
    }

    const db = await getConnection();

    const [result] = await db.execute<ResultSetHeader>(
      `
      UPDATE quizzes
      SET name = ?, description = ?, prompt = ?, num_questions = ?
      WHERE id = ?
      `,
      [name || "", description || "", prompt || "", numQuestions || 10, id]
    );

    await db.end();

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Quiz updated successfully" });
  } catch (err: any) {
    console.error("❌ Error updating quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
