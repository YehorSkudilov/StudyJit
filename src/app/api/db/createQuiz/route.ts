import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // 🔒 Require logged-in user
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { name, description = "", prompt = "", numQuestions = 10 } = await req.json();

    // 🧩 Basic validation
    if (!name?.trim()) {
      return NextResponse.json({ error: "Quiz name is required" }, { status: 400 });
    }

    const validNumQuestions = Math.min(Math.max(Number(numQuestions), 1), 50); // clamp 1–50

    // 🛡️ Check if quiz name already exists for this user
    const [existing]: any = await db.query(
      `SELECT id FROM quizzes WHERE name = ? AND user_id = ?`,
      [name.trim(), userId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You already have a quiz with this name" },
        { status: 409 }
      );
    }

    // 🧠 Insert new quiz
    const [result]: any = await db.query(
      `INSERT INTO quizzes (name, description, prompt, num_questions, user_id, generation_status)
       VALUES (?, ?, ?, ?, ?, 'never_generated')`,
      [name.trim(), description, prompt, validNumQuestions, userId]
    );

    console.log(`✅ Created quiz '${name}' for user ${userId}`);

    return NextResponse.json({
      success: true,
      quizId: result.insertId,
      message: "Quiz created successfully",
    });
  } catch (err: any) {
    console.error("❌ Error creating quiz:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
