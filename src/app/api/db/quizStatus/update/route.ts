import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: "Missing quiz ID or status" }, { status: 400 });
    }

    const db = await getConnection();
    const [result] = await db.execute<ResultSetHeader>(
      "UPDATE quizzes SET generation_status = ? WHERE id = ?",
      [status, id]
    );
    await db.end();

    if (result.affectedRows === 0)
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating status:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
