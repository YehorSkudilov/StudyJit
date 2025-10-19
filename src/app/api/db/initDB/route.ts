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
      console.log("🟡 Updating ENUM for generation_status to include 'never_generated'...");
      await db.query(`
        ALTER TABLE quizzes 
        MODIFY generation_status 
        ENUM('never_generated','pending','success','failed') 
        DEFAULT 'never_generated';
      `);
    }
  } else {
    console.log("🟢 Creating generation_status column...");
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
  /* ✅ USERS TABLE - Now includes bio column */
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

  /* ✅ QUIZZES TABLE (Linked to user) */
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

  /* ✅ QUIZ QUESTIONS TABLE (Linked to quiz and user) */
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

  /* ✅ FILES TABLE (Linked to user) */
  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      size BIGINT,
      mime_type VARCHAR(255),
      path VARCHAR(512) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

  console.log("🔧 Checking and adding missing columns...");

  /* 🔧 AUTO-UPGRADE Columns for Backward Compatibility */
  // Add bio column to users table if it doesn't exist
  await ensureColumnExists("users", "bio", "TEXT");
  
  await ensureColumnExists("quizzes", "user_id", "INT NOT NULL DEFAULT 1");
  await ensureColumnExists("quiz_questions", "user_id", "INT NOT NULL DEFAULT 1");
  await ensureColumnExists("files", "user_id", "INT NOT NULL DEFAULT 1");
  await ensureColumnExists("quiz_files", "user_id", "INT NOT NULL DEFAULT 1");

  await ensureColumnExists("quizzes", "prompt", "TEXT");
  await ensureColumnExists("quizzes", "num_questions", "INT DEFAULT 10");
  await ensureColumnExists("quizzes", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

  await ensureEnumIncludesNeverGenerated();

  console.log("✅ Database schema verified and upgraded with user linkage and bio column.");

  return {
    success: true,
    message: "✅ All tables verified and upgraded with user_id linkage and bio column.",
  };
}

/* --------------------------- API Route Handlers --------------------------- */
export async function GET() {
  try {
    console.log("🚀 Starting database initialization...");
    const result = await initDatabase();
    console.log("✅ Database initialization completed successfully");
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("❌ initDatabase error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return await GET();
}