import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import db from "@/lib/db";

// ✅ Fetch user profile (GET)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    console.log("Session data:", session ? "Found" : "Not found");

    if (!session?.user?.id) {
      console.log("Unauthorized: No session or user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching profile for user ID:", session.user.id);

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, bio FROM users WHERE id = ?",
      [Number(session.user.id)]
    );

    console.log("Query result:", rows.length, "rows found");

    const user = rows[0];
    if (!user) {
      console.log("User not found in database");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("Profile fetched successfully");
    return NextResponse.json(user, { status: 200 });
  } catch (error: any) {
    console.error("Profile fetch error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch profile",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }
}