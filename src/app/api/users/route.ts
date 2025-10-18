import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { RowDataPacket } from "mysql2";
import db from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, name, email, bio FROM users WHERE id = ?",
    [session.user.id]
  );

  const user = rows[0];

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  return new Response(JSON.stringify(user), { status: 200 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const { name, email, bio } = body;

  if (!name || !email) {
    return new Response(JSON.stringify({ error: "Name and email are required" }), { status: 400 });
  }

  try {
    await db.query(
      "UPDATE users SET name = ?, email = ?, bio = ? WHERE id = ?",
      [name, email, bio || "", session.user.id]
    );

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to update profile" }), { status: 500 });
  }
}
