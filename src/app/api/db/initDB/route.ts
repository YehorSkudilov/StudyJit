import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

// Shared logic for both GET and POST
async function initDatabase() {
  const db = await getConnection();

  await db.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quiz_id INT,
      question TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer VARCHAR(255),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
  `);

  await db.end();
  return { success: true, message: "✅ Tables ready" };
}

// POST → manual trigger (same as before)
export async function POST() {
  try {
    const result = await initDatabase();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("DB init error (POST):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET → now also triggers table creation
export async function GET() {
  try {
    const result = await initDatabase();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("DB init error (GET):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
