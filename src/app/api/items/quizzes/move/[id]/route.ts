import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const raw = await req.text(); // capture full body
    console.log("📨 RAW body:", raw);

    const body = raw ? JSON.parse(raw) : {};
    let { folder_id } = body;

    console.log("📦 [PATCH] Move quiz:", id, "→ folder:", folder_id);

    if (!id) {
      console.error("❌ Missing ID");
      return NextResponse.json({ error: "Missing quiz ID" }, { status: 400 });
    }

    // Normalize folder_id
    if (!folder_id || folder_id === "root") folder_id = null;
    else folder_id = Number(folder_id);

    console.log("🧹 Normalized folder_id:", folder_id);

    const [result]: any = await db.query(
      "UPDATE quizzes SET folder_id = ? WHERE id = ?",
      [folder_id, Number(id)]
    );
    console.log("🗃️ [DB Update Result]:", result);

    const [rows]: any = await db.query(
      "SELECT id, name, folder_id FROM quizzes WHERE id = ?",
      [Number(id)]
    );
    console.log("📊 [After update]:", rows);

    return NextResponse.json({ success: true, updated: rows[0], raw: result });
  } catch (err: any) {
    console.error("❌ [Move quiz error]:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
