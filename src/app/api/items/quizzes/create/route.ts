import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

/**
 * Create a new quiz (allows duplicate names)
 */
export async function POST(req: NextRequest) {
  console.log("🟡 [CreateQuiz] Request received");

  try {
    // 1️⃣ Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("🔴 [CreateQuiz] Unauthorized - missing session");
      return NextResponse.json(
        { error: "Unauthorized - user not logged in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`🟢 [CreateQuiz] Authenticated user: ${userId}`);

    // 2️⃣ Parse and validate request body
    let body: any;
    try {
      body = await req.json();
    } catch {
      console.error("🔴 [CreateQuiz] Invalid JSON in request");
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      name,
      description = "",
      prompt = "",
      numQuestions = 10,
      folder_id = null,
    } = body;

    if (!name?.trim()) {
      console.warn("🟠 [CreateQuiz] Missing quiz name");
      return NextResponse.json(
        { error: "Quiz name is required" },
        { status: 400 }
      );
    }

    const validNumQuestions = Math.min(Math.max(Number(numQuestions) || 10, 1), 50);

    // 3️⃣ Insert (duplicates allowed)
    console.log("🟢 [CreateQuiz] Inserting quiz into database...");
    const query = `
      INSERT INTO quizzes 
        (user_id, folder_id, name, description, prompt, num_questions, generation_status)
      VALUES (?, ?, ?, ?, ?, ?, 'never_generated')
    `;

    const params = [
      userId,
      folder_id || null,
      name.trim(),
      description,
      prompt,
      validNumQuestions,
    ];

    try {
      const [result]: any = await db.query(query, params);
      console.log(
        `✅ [CreateQuiz] Quiz created successfully. ID: ${result.insertId}, Folder: ${folder_id ?? "root"}`
      );

      return NextResponse.json({
        success: true,
        quizId: result.insertId,
        folderId: folder_id ?? "root",
        message: "Quiz created successfully",
      });
    } catch (sqlErr: any) {
      console.error("❌ [CreateQuiz] SQL Error:", sqlErr);
      return NextResponse.json(
        {
          error: "Database insert failed",
          details: sqlErr.message,
          code: sqlErr.code,
          sqlState: sqlErr.sqlState,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    // 4️⃣ Catch-all (unexpected)
    console.error("❌ [CreateQuiz] Unexpected server error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
