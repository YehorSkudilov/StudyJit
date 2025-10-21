import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

export async function POST(req: Request) {
  // 🔒 Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { quizId, fileId } = await req.json();

    if (!quizId || !fileId) {
      return NextResponse.json(
        { error: "Missing quizId or fileId" },
        { status: 400 }
      );
    }

    // ✅ Ensure quiz belongs to user
    const [quizRows]: any = await db.query(
      "SELECT id FROM quizzes WHERE id = ? AND user_id = ?",
      [quizId, userId]
    );
    if (quizRows.length === 0) {
      return NextResponse.json(
        { error: "Quiz not found or not owned by user" },
        { status: 403 }
      );
    }

    // ✅ Ensure file belongs to user
    const [fileRows]: any = await db.query(
      "SELECT id, name, path FROM files WHERE id = ? AND user_id = ?",
      [fileId, userId]
    );
    if (fileRows.length === 0) {
      return NextResponse.json(
        { error: "File not found or not owned by user" },
        { status: 403 }
      );
    }

    // ✅ Check if already linked
    const [existing]: any = await db.query(
      "SELECT id FROM quiz_files WHERE quiz_id = ? AND file_id = ?",
      [quizId, fileId]
    );
    if (existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: "File already linked to this quiz.",
      });
    }

    // ✅ Create new link
    await db.query("INSERT INTO quiz_files (quiz_id, file_id) VALUES (?, ?)", [
      quizId,
      fileId,
    ]);

    console.log(`📎 Linked file #${fileId} to quiz #${quizId} for user #${userId}`);

    const file = fileRows[0];

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        file_path: file.path,
      },
    });
  } catch (err: any) {
    console.error("❌ Error linking file:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
