import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

/* ----------------------------- GET /api/users ----------------------------- */
/**
 * Fetches the first user’s profile info.
 * Later you can replace with actual session-based user retrieval.
 */
export async function GET() {
  try {
    const [rows] = await db.query("SELECT id, name, email, bio FROM users ORDER BY id ASC LIMIT 1;");
    const user = (rows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: "No users found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err: any) {
    console.error("❌ Error fetching user:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ---------------------------- PATCH /api/users ---------------------------- */
/**
 * Updates profile fields and optionally changes password.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { name, email, bio, currentPassword, newPassword } = body;

    // 🧠 Find user by email
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    const user = (rows as any[])[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 🔐 Handle password change (optional)
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
      await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
    }

    // 🧩 Update name, email, bio
    await db.query("UPDATE users SET name = ?, email = ?, bio = ? WHERE id = ?", [
      name,
      email,
      bio,
      user.id,
    ]);

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (err: any) {
    console.error("❌ Error updating profile:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
