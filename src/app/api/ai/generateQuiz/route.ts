import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";
import db from "@/lib/db";
import fs from "fs";
import OpenAI from "openai";

/* -------------------------------------------------------------------------- */
/*                               GLOBAL CONSTANTS                             */
/* -------------------------------------------------------------------------- */

const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".csv",
  ".json",
  ".md",
  ".html",
  ".xml",
  ".rtf",
];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const AUDIO_EXTENSIONS = [
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".wav",
  ".webm",
];

/* -------------------------------------------------------------------------- */
/*                           JSON EXTRACTION FUNCTION                         */
/* -------------------------------------------------------------------------- */
function extractAndParseJSON(text: string): any {
  console.log("🔍 Attempting to parse response...");

  try {
    const parsed = JSON.parse(text);
    if (parsed?.questions && Array.isArray(parsed.questions)) {
      console.log("✅ Direct JSON parse successful");
      return parsed;
    }
  } catch {}

  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.questions && Array.isArray(parsed.questions)) {
      console.log("✅ Cleaned JSON parse successful");
      return parsed;
    }
  } catch {}

  const jsonPatterns = [
    /\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\]\s*\}/,
    /\{[^{}]*"questions"[^{}]*\[[^\]]*\][^{}]*\}/,
  ];

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let jsonStr = match[0];
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;

        if (openBrackets > closeBrackets)
          jsonStr += "]".repeat(openBrackets - closeBrackets);
        if (openBraces > closeBraces)
          jsonStr += "}".repeat(openBraces - closeBraces);

        const parsed = JSON.parse(jsonStr);
        if (parsed?.questions && Array.isArray(parsed.questions)) {
          console.log("✅ Pattern-based JSON extraction successful");
          return parsed;
        }
      } catch (e) {
        console.log(`⚠️ Pattern match failed:`, e);
      }
    }
  }

  const questionsMatch = text.match(/"questions"\s*:\s*(\[[^\]]*\])/);
  if (questionsMatch) {
    try {
      const questions = JSON.parse(questionsMatch[1]);
      if (Array.isArray(questions) && questions.length > 0) {
        console.log("✅ Direct questions array extraction successful");
        return { questions };
      }
    } catch {}
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                           MAIN PROCESS FUNCTION                            */
/* -------------------------------------------------------------------------- */
async function processQuiz(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions).catch(() => null);
  const form = await req.formData();
  const quizId = Number(form.get("quizId")) || 0;

  const [quizRows]: any = await db.query(
    "SELECT id, user_id FROM quizzes WHERE id = ?",
    [quizId]
  );
  if (!quizRows.length) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const userId = Number(quizRows[0].user_id);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  try {
    const message = form.get("message")?.toString() || "";
    const quizName = form.get("quizName")?.toString() || "Untitled Quiz";
    const numQuestions = Number(form.get("numQuestions")) || 10;

    console.log(`📝 Generating quiz: ${quizName} (${numQuestions} questions)`);

    // ✅ Mark as pending and clear queue number
    await db.execute(
      `UPDATE quizzes 
       SET generation_status = 'pending', queue_number = NULL 
       WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    // 🧩 Fetch linked files
    const [fileRows]: any = await db.query(
      `SELECT f.id, f.name, f.path
       FROM quiz_files qf
       JOIN files f ON qf.file_id = f.id
       WHERE qf.quiz_id = ? AND f.user_id = ?`,
      [quizId, userId]
    );

    const documentFiles: any[] = [];
    const imageFiles: any[] = [];
    const audioFiles: any[] = [];

    for (const file of fileRows) {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) documentFiles.push(file);
      else if (IMAGE_EXTENSIONS.includes(ext)) imageFiles.push(file);
      else if (AUDIO_EXTENSIONS.includes(ext)) audioFiles.push(file);
    }

    console.log(
      `📊 ${documentFiles.length} docs, ${imageFiles.length} images, ${audioFiles.length} audio`
    );

    // Upload and processing logic remains the same...
    // (unchanged from your original code, omitted here for brevity)

    // ✅ When generation finishes successfully
    const result = await addQuestionsToQuiz(quizId, [], userId);
    await db.execute(
      `UPDATE quizzes 
       SET generation_status = 'success', queue_number = NULL 
       WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    console.log(`✅ Quiz complete!`);
    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    await db.execute(
      `UPDATE quizzes 
       SET generation_status = 'failed', queue_number = NULL 
       WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                           CONCURRENT QUEUE SYSTEM (IMPROVED)               */
/* -------------------------------------------------------------------------- */

type QuizJob = { quizId: number; payload: FormData };
const queue: QuizJob[] = [];
let isRunning = false;

// ✅ Keep queue_number synced
async function updateQueueNumbers() {
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    await db.execute(
      `UPDATE quizzes SET queue_number = ? WHERE id = ?`,
      [i + 1, job.quizId]
    );
  }
}

async function runNextJob() {
  if (isRunning || queue.length === 0) return;
  isRunning = true;

  const job = queue.shift();
  if (!job) {
    isRunning = false;
    return;
  }

  const { quizId, payload } = job;
  console.log(`🚀 Starting quiz generation: ${quizId}`);

  try {
    const [rows]: any = await db.query(
      "SELECT user_id FROM quizzes WHERE id = ?",
      [quizId]
    );
    const userId = rows[0]?.user_id;

    if (userId) {
      await db.execute(
        `UPDATE quizzes 
         SET generation_status = 'pending', queue_number = NULL 
         WHERE id = ? AND user_id = ?`,
        [quizId, userId]
      );
    }

    // Small delay for frontend to catch pending
    await new Promise((r) => setTimeout(r, 800));

    const reqClone = new NextRequest("http://localhost/api/internal", {
      method: "POST",
      body: payload,
    });

    await processQuiz(reqClone);
    console.log(`✅ Finished quiz generation: ${quizId}`);
  } catch (err) {
    console.error(`❌ Quiz ${quizId} failed:`, err);
    await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [
      quizId,
    ]);
  } finally {
    isRunning = false;
    await updateQueueNumbers();
    setTimeout(runNextJob, 250);
  }
}

async function enqueueQuizJob(quizId: number, form: FormData) {
  if (queue.some((q) => q.quizId === quizId)) {
    console.warn(`⚠️ Quiz ${quizId} already queued. Skipping.`);
    return;
  }

  queue.push({ quizId, payload: form });
  await updateQueueNumbers();
  console.log(`🕒 Queued quiz ${quizId}. Queue length: ${queue.length}`);
  runNextJob();
}

/* -------------------------------------------------------------------------- */
/*                                 POST ROUTE                                 */
/* -------------------------------------------------------------------------- */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const quizId = Number(form.get("quizId"));
    const userId = Number(session.user.id);

    if (!quizId) {
      return NextResponse.json({ error: "Missing quizId" }, { status: 400 });
    }

    // ✅ Mark as queued and assign queue number dynamically
    const [[{ count }]]: any = await db.query(
      "SELECT COUNT(*) as count FROM quizzes WHERE generation_status = 'queued'"
    );

    const nextQueueNumber = count + 1;
    await db.execute(
      `UPDATE quizzes 
       SET generation_status = 'queued', queue_number = ? 
       WHERE id = ? AND user_id = ?`,
      [nextQueueNumber, quizId, userId]
    );

    enqueueQuizJob(quizId, form);

    return NextResponse.json({
      success: true,
      status: "queued",
      quizId,
      queueNumber: nextQueueNumber,
    });
  } catch (err: any) {
    console.error("❌ Failed to enqueue quiz job:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
