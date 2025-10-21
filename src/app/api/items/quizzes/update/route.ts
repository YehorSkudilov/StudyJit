import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";
import { ResultSetHeader } from "mysql2";

/**
 * PATCH /api/items/quizzes/update
 * Body: { id, name?, description?, prompt?, numQuestions?, lastScore? }
 */
export async function PATCH(req: NextRequest) {
  try {
    // 🔒 Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id, name, description, prompt, numQuestions, lastScore } = await req.json();

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

    // ✅ Ensure 'last_score' column exists (for safety if DB not migrated yet)
    const [cols]: any = await db.query(`SHOW COLUMNS FROM quizzes LIKE 'last_score'`);
    if (cols.length === 0) {
      await db.query(`ALTER TABLE quizzes ADD COLUMN last_score DECIMAL(5,2) NULL`);
      console.log("🟢 Added missing column 'last_score' to quizzes");
    }

    // ✅ Construct update set dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (prompt !== undefined) {
      updates.push("prompt = ?");
      params.push(prompt);
    }
    if (numQuestions !== undefined) {
      updates.push("num_questions = ?");
      params.push(numQuestions);
    }
    if (lastScore !== undefined && !isNaN(Number(lastScore))) {
      updates.push("last_score = ?");
      params.push(Number(lastScore));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    params.push(id); // WHERE id = ?

    // ✅ Perform update
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE quizzes SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    console.log(`✅ User #${userId} updated quiz #${id} ${lastScore ? `(score: ${lastScore})` : ""}`);

    return NextResponse.json({
      success: true,
      message: `Quiz updated successfully${lastScore ? " (score updated)" : ""}`,
    });
  } catch (err: any) {
    console.error("❌ Error updating quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
