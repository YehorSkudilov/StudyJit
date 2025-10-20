import { NextResponse } from "next/server";
import db from "@/lib/db";

/* ------------------------- Utility: Column Check ------------------------- */
async function ensureColumnExists(table: string, column: string, definition: string) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if ((rows as any[]).length === 0) {
    console.log(`🟡 Adding missing column '${column}' to '${table}'...`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Column '${column}' added to '${table}'`);
  } else {
    console.log(`✅ Column '${column}' already exists in '${table}'`);
  }
}

/* ----------------------- Utility: ENUM Fix for Quizzes ----------------------- */
async function ensureEnumIncludesNeverGenerated() {
  const [rows] = await db.query(`SHOW COLUMNS FROM quizzes LIKE 'generation_status'`);
  if ((rows as any[]).length > 0) {
    const type = (rows as any[])[0].Type;
    if (!type.includes("never_generated")) {
      console.log("🟡 Updating ENUM for generation_status...");
      await db.query(`
        ALTER TABLE quizzes 
        MODIFY generation_status 
        ENUM('never_generated','pending','success','failed') 
        DEFAULT 'never_generated';
      `);
    }
  } else {
    await db.query(`
      ALTER TABLE quizzes 
      ADD COLUMN generation_status 
      ENUM('never_generated','pending','success','failed') 
      DEFAULT 'never_generated';
    `);
  }
}

/* --------------------------- Core Init Function --------------------------- */
async function initDatabase() {
  /* ✅ USERS */
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

  /* ✅ FOLDERS (real DB folders) */
  await db.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_path VARCHAR(512) NOT NULL DEFAULT 'root',
      full_path VARCHAR(512) GENERATED ALWAYS AS (CONCAT(parent_path, '/', name)) STORED,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  /* ✅ FILES */
  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      size BIGINT,
      mime_type VARCHAR(255),
      folder_id INT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
  `);

  /* ✅ QUIZZES */
  await db.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      folder_id INT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      prompt TEXT,
      num_questions INT DEFAULT 10,
      generation_status ENUM('never_generated','pending','success','failed') DEFAULT 'never_generated',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
  `);

  /* ✅ QUIZ QUESTIONS */
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

  /* ✅ QUIZ ↔ FILE LINK TABLE */
  await db.query(`
    CREATE TABLE IF NOT EXISTS quiz_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quiz_id INT NOT NULL,
      file_id INT NOT NULL,
      user_id INT NOT NULL,
      linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  /* 🔧 Backwards compatibility */
  await ensureColumnExists("users", "bio", "TEXT");
  await ensureColumnExists("quizzes", "user_id", "INT NOT NULL DEFAULT 1");
  await ensureColumnExists("quiz_questions", "user_id", "INT NOT NULL DEFAULT 1");
  await ensureColumnExists("files", "user_id", "INT NOT NULL DEFAULT 1");
  await ensureEnumIncludesNeverGenerated();

  console.log("✅ Database schema verified with folder support");
  return { success: true, message: "✅ Database initialized with folders table." };
}

/* --------------------------- API Route Handlers --------------------------- */
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
