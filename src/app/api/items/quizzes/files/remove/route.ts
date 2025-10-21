import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import db from "@/lib/db";

/**
 * Removes the link between a quiz and a file (does NOT delete the actual file).
 * Only allowed if the quiz belongs to the logged-in user.
 */
export async function POST(req: Request) {
  // 🔒 Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { quiz_id, file_id } = await req.json();

    if (!quiz_id || !file_id) {
      return NextResponse.json(
        { error: "Missing quiz_id or file_id" },
        { status: 400 }
      );
    }

    // ✅ Verify quiz belongs to the logged-in user
    const [quizRows]: any = await db.query(
      "SELECT id FROM quizzes WHERE id = ? AND user_id = ?",
      [quiz_id, userId]
    );

    if (quizRows.length === 0) {
      return NextResponse.json(
        { error: "Quiz not found or not owned by user" },
        { status: 403 }
      );
    }

    // ✅ Unlink the file safely
    const [result]: any = await db.query(
      "DELETE FROM quiz_files WHERE quiz_id = ? AND file_id = ?",
      [quiz_id, file_id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        message: "No matching link found",
      });
    }

    console.log(
      `🗑️ Unlinked file #${file_id} from quiz #${quiz_id} (user #${userId})`
    );

    return NextResponse.json({
      success: true,
      message: "File unlinked successfully",
    });
  } catch (err: any) {
    console.error("❌ Error unlinking file:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
