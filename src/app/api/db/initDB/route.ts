import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

async function ensureColumnExists(db: any, table: string, column: string, definition: string) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (rows.length === 0) {
    console.log(`🟡 Adding missing column '${column}' to '${table}'...`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * ✅ Ensure ENUM('never_generated', 'pending', 'success', 'failed') exists
 * If 'generation_status' column exists, adds 'never_generated' if missing.
 */
async function ensureEnumIncludesNeverGenerated(db: any) {
  const [rows] = await db.query(`SHOW COLUMNS FROM quizzes LIKE 'generation_status'`);
  if (rows.length > 0) {
    const column = rows[0];
    const type = column.Type; // e.g. enum('pending','success','failed')
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
    console.log("🟢 Creating generation_status column with full ENUM definition...");
    await db.query(`
      ALTER TABLE quizzes 
      ADD COLUMN generation_status 
      ENUM('never_generated','pending','success','failed') 
      DEFAULT 'never_generated';
    `);
  }
}

async function initDatabase() {
  const db = await getConnection();

  // ✅ Quizzes table
  await db.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      prompt TEXT,
      num_questions INT DEFAULT 10,
      generation_status ENUM('never_generated','pending','success','failed') DEFAULT 'never_generated',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ✅ Quiz questions table
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

  // ✅ Uploaded files table
  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      size BIGINT,
      mime_type VARCHAR(255),
      path VARCHAR(512) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ✅ Link table (quiz ↔ files)
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

  // ✅ Auto-upgrade columns if missing
  await ensureColumnExists(db, "quizzes", "prompt", "TEXT");
  await ensureColumnExists(db, "quizzes", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await ensureColumnExists(db, "quizzes", "num_questions", "INT DEFAULT 10");

  // ✅ Ensure ENUM column exists and includes 'never_generated'
  await ensureEnumIncludesNeverGenerated(db);

  console.log("✅ Database schema verified and upgraded (including num_questions + ENUM).");

  await db.end();
  return {
    success: true,
    message: "✅ All tables verified and upgraded (including num_questions and ENUM).",
  };
}

// ✅ GET or POST both call initDatabase
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
