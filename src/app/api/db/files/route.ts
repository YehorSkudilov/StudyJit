import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ correct path
import db from "@/lib/db";

export async function GET() {
  try {
    // 🔒 Require login
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // ✅ Fetch only user's own files
    const [rows]: any = await db.query(
      "SELECT * FROM files WHERE user_id = ? ORDER BY uploaded_at DESC",
      [userId]
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ Fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
