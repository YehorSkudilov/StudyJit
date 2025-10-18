import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();

    // 🧩 Validate input
    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing quiz ID or status" },
        { status: 400 }
      );
    }

    // ✅ Use the shared pool directly
    const [result] = await db.execute<ResultSetHeader>(
      "UPDATE quizzes SET generation_status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    console.log(`✅ Updated quiz #${id} → status: ${status}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Error updating quiz status:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
