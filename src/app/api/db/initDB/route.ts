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

/* ------------------------- Utility: Drop Old Columns ------------------------- */
async function dropOldColumns() {
  // Drop old quiz columns
  const [quizCols]: any = await db.query(`SHOW COLUMNS FROM quizzes`);
  const quizColNames = quizCols.map((c: any) => c.Field);

  for (const col of ["folder_path", "path"]) {
    if (quizColNames.includes(col)) {
      console.log(`🗑️ Dropping old column '${col}' from 'quizzes'...`);
      await db.query(`ALTER TABLE quizzes DROP COLUMN ${col}`);
      console.log(`✅ Dropped '${col}' from 'quizzes'`);
    }
  }

  // Drop old folder path column
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
      path TEXT NULL,                 -- ✅ Include it directly
      size BIGINT,
      mime_type VARCHAR(255),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
  `);

  // 🔒 Ensure for backward compatibility
  await ensureColumnExists("files", "folder_id", "INT NULL");
  await ensureColumnExists("files", "path", "TEXT NULL");

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
      folder_id INT NULL,
      last_score DECIMAL(5,2) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
  `);

  // 🔄 Update ENUM if needed
  const [enumCheck]: any = await db.query(`SHOW COLUMNS FROM quizzes LIKE 'generation_status'`);
  const enumType = enumCheck[0]?.Type || "";
  if (!enumType.includes("queued")) {
    console.log("🟡 Updating 'generation_status' ENUM to include 'queued'...");
    await db.query(`
      ALTER TABLE quizzes 
      MODIFY COLUMN generation_status 
      ENUM('never_generated','queued','pending','success','failed') 
      DEFAULT 'never_generated';
    `);
    console.log("✅ Updated ENUM with 'queued' value");
  }

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

  /* ---------------- CLEANUP ---------------- */
  await dropOldColumns();

  console.log("✅ Database schema synchronized successfully (path supported).");
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
