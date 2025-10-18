import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const db = await getConnection();
    const [rows]: any = await db.query(
      `
      SELECT f.id, f.name, f.path AS file_path
      FROM quiz_files qf
      JOIN files f ON qf.file_id = f.id
      WHERE qf.quiz_id = ?
      ORDER BY f.uploaded_at DESC
      `,
      [id]
    );
    await db.end();

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ Error fetching quiz files:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
