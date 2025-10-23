import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  console.log("🟡 [CreateQuiz] Request received");

  try {
    // 1️⃣ Verify user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("🔴 [CreateQuiz] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`🟢 [CreateQuiz] User ID: ${userId}`);

    // 2️⃣ Parse JSON
    const body = await req.json().catch(() => null);
    if (!body) {
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

    // 3️⃣ Validate name
    if (!name?.trim()) {
      return NextResponse.json({ error: "Quiz name is required" }, { status: 400 });
    }

    const validNumQuestions = Math.min(Math.max(Number(numQuestions), 1), 50);

    // 4️⃣ Directly insert (no duplicate check)
    const [result]: any = await db.query(
      `INSERT INTO quizzes (user_id, folder_id, name, description, prompt, num_questions, generation_status)
       VALUES (?, ?, ?, ?, ?, ?, 'never_generated')`,
      [userId, folder_id || null, name.trim(), description, prompt, validNumQuestions]
    );

    console.log(`✅ [CreateQuiz] Created quiz '${name}' in folder ${folder_id ?? "root"}`);

    return NextResponse.json({
      success: true,
      quizId: result.insertId,
      folderId: folder_id ?? "root",
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