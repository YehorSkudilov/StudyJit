import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Export runtime config if needed
export const dynamic = 'force-dynamic';

/* ----------------------------- GET /api/users ----------------------------- */
/**
 * Fetches the current logged-in user's profile info from session.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔍 GET /api/users - Session:", session);
    console.log("🔍 Fetching user with ID:", session.user.id);

    const [rows] = await db.query(
      "SELECT id, name, email, bio FROM users WHERE id = ?",
      [parseInt(session.user.id)] // Convert to number
    );
    const user = (rows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err: any) {
    console.error("❌ Error fetching user:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ---------------------------- PATCH /api/users ---------------------------- */
/**
 * Updates current user's profile fields and optionally changes password.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { name, email, bio, currentPassword, newPassword } = body;

    console.log("🔍 PATCH /api/users - User ID:", userId);

    // Get current user
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = (rows as any[])[0];
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle password change (optional)
    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long" },
          { status: 400 }
        );
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, userId]);
    }

    // Update name, email, bio
    await db.query(
      "UPDATE users SET name = ?, email = ?, bio = ? WHERE id = ?",
      [name, email, bio, userId]
    );

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (err: any) {
    console.error("❌ Error updating profile:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}