import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // ✅ ensure correct path

/* ----------------------------- GET /api/users ----------------------------- */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log("Session info:", session);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [rows] = await db.query("SELECT id, name, email, bio FROM users WHERE id = ?", [
      session.user.id,
    ]);
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
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { name, email, bio, currentPassword, newPassword } = body;

    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = (rows as any[])[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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

    await db.query("UPDATE users SET name = ?, email = ?, bio = ? WHERE id = ?", [
      name,
      email,
      bio,
      userId,
    ]);

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (err: any) {
    console.error("❌ Error updating profile:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
