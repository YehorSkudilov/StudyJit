import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

/**
 * Removes the link between a quiz and a file (does NOT delete the actual file).
 */
export async function POST(req: Request) {
  try {
    const { quiz_id, file_id } = await req.json();

    if (!quiz_id || !file_id)
      return NextResponse.json({ error: "Missing quiz_id or file_id" }, { status: 400 });

    const db = await getConnection();

    const [result]: any = await db.query(
      "DELETE FROM quiz_files WHERE quiz_id = ? AND file_id = ?",
      [quiz_id, file_id]
    );

    await db.end();

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: "No matching link found" });
    }

    return NextResponse.json({ success: true, message: "File unlinked successfully" });
  } catch (err: any) {
    console.error("❌ Error unlinking file:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
