import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { quizId, fileId } = await req.json();

    const db = await getConnection();

    // Check if already linked
    const [existing]: any = await db.query(
      "SELECT * FROM quiz_files WHERE quiz_id = ? AND file_id = ?",
      [quizId, fileId]
    );
    if (existing.length > 0) {
      await db.end();
      return NextResponse.json({
        success: false,
        message: "File already linked to this quiz.",
      });
    }

    // Insert new link
    await db.query(
      "INSERT INTO quiz_files (quiz_id, file_id) VALUES (?, ?)",
      [quizId, fileId]
    );

    // Fetch linked file info
    const [rows]: any = await db.query(
      `SELECT f.id, f.name, f.path AS file_path
       FROM files f
       WHERE f.id = ?`,
      [fileId]
    );

    await db.end();

    return NextResponse.json({
      success: true,
      file: rows[0], // ✅ always return full file object
    });
  } catch (err: any) {
    console.error("❌ Error linking file:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
