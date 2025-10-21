import { NextResponse } from "next/server";
import db from "@/lib/db";

/* ------------------------- Utility: Ensure Column ------------------------- */
async function ensureColumnExists(
  table: string,
  column: string,
  definition: string
) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if ((rows as any[]).length === 0) {
    console.log(`🟡 Adding missing column '${column}' to '${table}'...`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Added '${column}' to '${table}'`);
  }
}

/* ------------------------- Utility: Drop Old Columns ------------------------- */
async function dropOldColumns() {
  // 🧩 Drop legacy folder_path/path from quizzes
  const [quizCols]: any = await db.query(`SHOW COLUMNS FROM quizzes`);
  const quizColNames = quizCols.map((c: any) => c.Field);

  for (const col of ["folder_path", "path"]) {
    if (quizColNames.includes(col)) {
      console.log(`🗑️ Dropping old column '${col}' from 'quizzes'...`);
      await db.query(`ALTER TABLE quizzes DROP COLUMN ${col}`);
      console.log(`✅ Dropped '${col}' from 'quizzes'`);
    }
  }

  // 🧩 Drop legacy path from folders
  const [folderCols]: any = await db.query(`SHOW COLUMNS FROM folders`);
  const folderColNames = folderCols.map((c: any) => c.Field);
  if (folderColNames.includes("path")) {
    console.log("🗑️ Dropping old column 'path' from 'folders'...");
    await db.query(`ALTER TABLE folders DROP COLUMN path`);
    console.log("✅ Dropped 'path' from 'folders'");
  }
}

/* --------------------------- Database Setup --------------------------- */
async function initDatabase() {
  /* USERS */
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

  /* FOLDERS (shared for both files + quizzes, with context) */
  await db.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ✅ Ensure hierarchy + context
  await ensureColumnExists("folders", "parent_id", "INT NULL");
  await ensureColumnExists(
    "folders",
    "context",
    "ENUM('quizzes','files') NOT NULL DEFAULT 'quizzes'"
  );

  /* FILES */
  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      size BIGINT,
      mime_type VARCHAR(255),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ✅ Link files to folders
  await ensureColumnExists("files", "folder_id", "INT NULL");

  /* QUIZZES */
  await db.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      prompt TEXT,
      num_questions INT DEFAULT 10,
      generation_status ENUM('never_generated','pending','success','failed') DEFAULT 'never_generated',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ✅ Link quizzes to folders and add last_score
  await ensureColumnExists("quizzes", "folder_id", "INT NULL");
  await ensureColumnExists("quizzes", "last_score", "DECIMAL(5,2) NULL");

  /* QUIZ QUESTIONS */
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

  // 🧹 Cleanup
  await dropOldColumns();

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return await GET();
}
