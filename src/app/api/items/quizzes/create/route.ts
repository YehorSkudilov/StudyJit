import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  console.log("🟡 [CreateQuiz] Request received");

  try {
    // 1️⃣ Try to get session
    const session = await getServerSession(authOptions);
    console.log("🟢 [CreateQuiz] Session:", session);

    if (!session?.user?.id) {
      console.error("🔴 [CreateQuiz] No valid user session");
      return NextResponse.json({ error: "Unauthorized (no session)" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`🟢 [CreateQuiz] User ID: ${userId}`);

    // 2️⃣ Parse JSON body
    let body: any;
    try {
      body = await req.json();
    } catch {
      console.error("🔴 [CreateQuiz] Failed to parse request JSON");
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      name,
      description = "",
      prompt = "",
      numQuestions = 10,
      folder_id = null,
    } = body;

    console.log("🟢 [CreateQuiz] Body:", body);

    // 3️⃣ Validation
    if (!name?.trim()) {
      console.error("🔴 [CreateQuiz] Missing quiz name");
      return NextResponse.json({ error: "Quiz name is required" }, { status: 400 });
    }

    const validNumQuestions = Math.min(Math.max(Number(numQuestions), 1), 50);

    // 4️⃣ Check duplicates
    const [existing]: any = await db.query(
      `SELECT id FROM quizzes WHERE user_id = ? AND name = ?`,
      [userId, name.trim()]
    );
    console.log("🟢 [CreateQuiz] Existing quizzes with same name:", existing.length);

    if (existing.length > 0) {
      console.warn("🟠 [CreateQuiz] Duplicate quiz name detected");
      return NextResponse.json(
        { error: "You already have a quiz with this name" },
        { status: 409 }
      );
    }

    // 5️⃣ Insert quiz
    const [result]: any = await db.query(
      `INSERT INTO quizzes (user_id, folder_id, name, description, prompt, num_questions, generation_status)
       VALUES (?, ?, ?, ?, ?, ?, 'never_generated')`,
      [userId, folder_id, name.trim(), description, prompt, validNumQuestions]
    );

    console.log("✅ [CreateQuiz] Quiz inserted:", result);

    return NextResponse.json({
      success: true,
      quizId: result.insertId,
      message: "Quiz created successfully",
    });
  } catch (err: any) {
    console.error("❌ [CreateQuiz] Uncaught error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error", stack: err.stack },
      { status: 500 }
    );
  }
}
