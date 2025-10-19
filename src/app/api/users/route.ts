import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import db from "@/lib/db";

// ✅ Fetch user profile (GET)
export async function GET(req: NextRequest) {
  console.log("=== /api/users GET request started ===");
  
  try {
    // Check database connection first
    console.log("Testing database connection...");
    try {
      await db.query("SELECT 1");
      console.log("✅ Database connection successful");
    } catch (dbError: any) {
      console.error("❌ Database connection failed:", dbError);
      return NextResponse.json(
        { 
          error: "Database connection failed",
          details: dbError.message 
        },
        { status: 500 }
      );
    }

    // Get session
    console.log("Fetching session...");
    const session = await getServerSession(authOptions);
    console.log("Session:", JSON.stringify(session, null, 2));

    if (!session?.user?.id) {
      console.log("❌ Unauthorized: No session or user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ Session found for user ID:", session.user.id);

    // Check if bio column exists
    console.log("Checking if bio column exists...");
    try {
      const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'bio'");
      console.log("Bio column check result:", columns);
      if ((columns as any[]).length === 0) {
        console.log("⚠️ WARNING: bio column does not exist in users table");
      } else {
        console.log("✅ Bio column exists");
      }
    } catch (colError: any) {
      console.error("Error checking bio column:", colError);
    }

    // Fetch user data
    console.log("Executing query: SELECT id, name, email, bio FROM users WHERE id = ?", [Number(session.user.id)]);
    
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, bio FROM users WHERE id = ?",
      [Number(session.user.id)]
    );

    console.log("Query executed successfully");
    console.log("Rows returned:", rows.length);
    console.log("Row data:", JSON.stringify(rows, null, 2));

    const user = rows[0];
    if (!user) {
      console.log("❌ User not found in database");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("✅ Profile fetched successfully");
    console.log("Returning user data:", JSON.stringify(user, null, 2));
    
    return NextResponse.json(user, { status: 200 });
    
  } catch (error: any) {
    console.error("❌❌❌ CRITICAL ERROR in /api/users GET ❌❌❌");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error errno:", error.errno);
    console.error("Error sqlMessage:", error.sqlMessage);
    console.error("Error sql:", error.sql);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    console.error("Error stack:", error.stack);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch profile",
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        details: process.env.NODE_ENV === "development" ? {
          type: error.constructor.name,
          message: error.message,
          code: error.code,
          errno: error.errno,
          sqlMessage: error.sqlMessage
        } : undefined
      },
      { status: 500 }
    );
  }
}