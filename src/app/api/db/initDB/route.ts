import { NextResponse } from "next/server";
import db from "@/lib/db";

/* ------------------------- Utility: Ensure Column ------------------------- */
async function ensureColumnExists(table: string, column: string, definition: string) {
  const [rows]: any = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (rows.length === 0) {
    console.log(`🟡 Adding missing column '${column}' to '${table}'...`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Added '${column}' to '${table}'`);
  }
}

/* --------------------------- Database Setup --------------------------- */
async function initDatabase() {
  /* ---------------- USERS ---------------- */
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      bio TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* ---------------- FOLDERS ---------------- */
  await db.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_id INT NULL,
      context ENUM('quizzes','files') NOT NULL DEFAULT 'quizzes',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  /* ---------------- FILES ---------------- */
  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      folder_id INT NULL,
      name VARCHAR(255) NOT NULL,
      path TEXT NULL,
      size BIGINT,
      mime_type VARCHAR(255),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
  `);

  /* ---------------- QUIZZES ---------------- */
  await db.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      prompt TEXT,
      num_questions INT DEFAULT 10,
      generation_status ENUM('never_generated','queued','pending','success','failed') DEFAULT 'never_generated',
      queue_number INT NULL,
      folder_id INT NULL,
      last_score DECIMAL(5,2) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
  `);

  // Ensure queue_number exists for existing databases
  await ensureColumnExists("quizzes", "queue_number", "INT NULL");

  /* ---------------- QUIZ FILES ---------------- */
  await db.query(`
    CREATE TABLE IF NOT EXISTS quiz_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quiz_id INT NOT NULL,
      file_id INT NOT NULL,
      linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );
  `);

  /* ---------------- QUIZ QUESTIONS ---------------- */
  await db.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quiz_id INT NOT NULL,
      user_id INT NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer VARCHAR(255),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log("✅ Database schema synchronized successfully.");
  return { success: true };
}

/* --------------------------- API Handler --------------------------- */
export async function GET() {
  try {
    const result = await initDatabase();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("❌ initDatabase error:", err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function POST() {
  return await GET();
}