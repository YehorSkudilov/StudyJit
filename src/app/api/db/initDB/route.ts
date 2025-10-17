import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

async function ensureColumnExists(db: any, table: string, column: string, definition: string) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (rows.length === 0) {
    console.log(`🟡 Adding missing column '${column}' to '${table}'...`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initDatabase() {
  const db = await getConnection();

  // ✅ Create base tables if missing
  await db.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      prompt TEXT,
      generation_status ENUM('pending','success','failed') DEFAULT 'pending',
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

  // ✅ Auto-upgrade existing schema
  await ensureColumnExists(db, "quizzes", "prompt", "TEXT");
  await ensureColumnExists(db, "quizzes", "generation_status", "ENUM('pending','success','failed') DEFAULT 'pending'");
  await ensureColumnExists(db, "quizzes", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

  console.log("✅ Database schema verified and upgraded.");
  await db.end();
  return { success: true, message: "✅ Tables verified and updated (with generation_status)" };
}

// GET or POST both call init
export async function GET() {
  try {
    const result = await initDatabase();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return await GET();
}
