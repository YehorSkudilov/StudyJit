import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

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

    // 🔐 Password change (optional)
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

    // 🧩 Update profile details
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
