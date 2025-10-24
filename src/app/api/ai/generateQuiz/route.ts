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
  ".pdf", ".txt", ".doc", ".docx", ".ppt", ".pptx",
  ".csv", ".json", ".md", ".html", ".xml", ".rtf",
];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"];

/* -------------------------------------------------------------------------- */
/*                           JSON EXTRACTION FUNCTION                         */
/* -------------------------------------------------------------------------- */
function extractAndParseJSON(text: string): any {
  console.log("🔍 extractAndParseJSON called with text length:", text.length);
  try {
    const parsed = JSON.parse(text);
    console.log("✅ Parsed valid JSON directly");
    if (parsed?.questions && Array.isArray(parsed.questions)) return parsed;
} catch (e) {
  if (e instanceof Error) {
    console.warn("⚠️ Direct parse failed:", e.message);
  } else {
    console.warn("⚠️ Direct parse failed:", e);
  }
}

  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  try {
    const parsed = JSON.parse(cleaned);
    console.log("✅ Parsed after cleaning markdown fences");
    if (parsed?.questions && Array.isArray(parsed.questions)) return parsed;
 } catch (e) {
  if (e instanceof Error) {
    console.warn("⚠️ Cleaned parse failed:", e.message);
  } else {
    console.warn("⚠️ Cleaned parse failed:", e);
  }
}


  const jsonMatch = text.match(/\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (jsonMatch) {
    try {
      console.log("✅ Matched JSON via regex extraction");
      return JSON.parse(jsonMatch[0]);
  } catch (e) {
  if (e instanceof Error) {
    console.warn("⚠️ Cleaned parse failed:", e.message);
  } else {
    console.warn("⚠️ Cleaned parse failed:", e);
  }
}

  }

  console.error("❌ Could not parse any valid JSON from response");
  return null;
}

/* -------------------------------------------------------------------------- */
/*                           MAIN PROCESS FUNCTION                            */
/* -------------------------------------------------------------------------- */
async function processQuiz(req: NextRequest): Promise<NextResponse> {
  console.log("🚀 processQuiz START");

  const form = await req.formData();
  const quizId = Number(form.get("quizId")) || 0;
  console.log("📥 Incoming quizId:", quizId);

  const [quizRows]: any = await db.query("SELECT id, user_id FROM quizzes WHERE id = ?", [quizId]);
  console.log("📄 Quiz rows:", quizRows);
  if (!quizRows.length) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const userId = Number(quizRows[0].user_id);
  console.log("👤 userId:", userId);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  try {
    const message = form.get("message")?.toString() || "";
    const quizName = form.get("quizName")?.toString() || "Untitled Quiz";
    const numQuestions = Number(form.get("numQuestions")) || 10;

    console.log(`📝 Generating quiz: ${quizName} (${numQuestions} questions)`);

    await db.execute(
      `UPDATE quizzes SET generation_status = 'pending' WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );
    console.log("🔄 Marked quiz as pending");

    const [fileRows]: any = await db.query(
      `SELECT f.id, f.name, f.path
       FROM quiz_files qf
       JOIN files f ON qf.file_id = f.id
       WHERE qf.quiz_id = ? AND f.user_id = ?`,
      [quizId, userId]
    );
    console.log("📂 Linked files:", fileRows);

    const documentFiles: any[] = [];
    const imageFiles: any[] = [];
    const audioFiles: any[] = [];

    for (const file of fileRows) {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) documentFiles.push(file);
      else if (IMAGE_EXTENSIONS.includes(ext)) imageFiles.push(file);
      else if (AUDIO_EXTENSIONS.includes(ext)) audioFiles.push(file);
    }

    console.log(`📊 Files categorized → docs:${documentFiles.length} imgs:${imageFiles.length} audio:${audioFiles.length}`);

    const documentFileIds: string[] = [];
    for (const file of documentFiles) {
      try {
        console.log(`⬆️ Uploading file to OpenAI: ${file.path}`);
        const upload = await openai.files.create({
          file: fs.createReadStream(file.path),
          purpose: "assistants",
        });
        documentFileIds.push(upload.id);
        console.log(`✅ Uploaded ${file.name} as ${upload.id}`);
      } catch (err: any) {
        console.warn(`⚠️ Upload failed for ${file.name}: ${err.message}`);
      }
    }

    console.log("🤖 Creating assistant...");
    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `Generate ${numQuestions} quiz questions in valid JSON format.`,
      response_format: { type: "json_object" },
    });
    console.log("✅ Assistant created:", assistant.id);

    const instruction = `
      Generate ${numQuestions} quiz questions.
      Topic: ${message}
      Respond ONLY in JSON format like:
      {"questions":[{"id":1,"question":"...","options":["A","B","C","D"],"correct":"A"}]}
    `;

    console.log("🧵 Creating thread...");
    const thread = await openai.beta.threads.create({
      messages: [{ role: "user", content: [{ type: "text", text: instruction }] }],
    });
    console.log("✅ Thread created:", thread.id);

    console.log("🏃 Running assistant...");
const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
  assistant_id: assistant.id,
  additional_instructions: `
    Use the uploaded documents as the primary study material for generating quiz questions.
    If the topic overlaps with the message, prioritize the document context.
    The questions must directly reflect the information in the attached files whenever possible.
    If there is no relevant content, fall back to the message prompt.
  `,
});

    console.log("🧩 Run status:", run.status);

    if (run.status !== "completed") throw new Error(`Assistant run failed: ${run.status}`);

    const messages = await openai.beta.threads.messages.list(thread.id);
    console.log("📬 Assistant messages received:", messages.data.length);

    const lastMessage = messages.data[0];
    if (!lastMessage) throw new Error("No assistant response received.");

    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") text += block.text.value;
    }

    console.log("🧾 Raw assistant text response length:", text.length);

    const parsed = extractAndParseJSON(text.trim());
    console.log("🧮 Parsed result:", parsed);

    if (!parsed?.questions) throw new Error("Could not parse questions from response.");

    const formatted = parsed.questions.map((q: any, i: number) => ({
      id: q.id || i + 1,
      question: q.question,
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : ["A", "B", "C", "D"],
      correct: q.correct || q.answer || q.options?.[0] || "A",
    }));

    console.log("✅ Final formatted questions:", formatted);

    await addQuestionsToQuiz(quizId, formatted, userId);
    console.log("✅ Added questions to DB");

    await db.execute(
      `UPDATE quizzes SET generation_status = 'success', queue_number = NULL WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    console.log(`🎉 Quiz ${quizId} successfully generated (${formatted.length} questions).`);
    return NextResponse.json({ success: true, quizId, questionCount: formatted.length });
  } catch (error: any) {
    console.error("❌ Generation error:", error);
    await db.execute(
      `UPDATE quizzes SET generation_status = 'failed', queue_number = NULL WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* -------------------------------------------------------------------------- */
/*                           QUEUE MANAGEMENT SYSTEM                          */
/* -------------------------------------------------------------------------- */
type QuizJob = { quizId: number; payload: FormData };
const queue: QuizJob[] = [];
let isRunning = false;

async function updateQueueNumbers() {
  console.log("🔢 Updating queue numbers...");
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    console.log(`  - Quiz ${job.quizId} set to position ${i + 1}`);
    await db.execute(`UPDATE quizzes SET queue_number = ? WHERE id = ?`, [i + 1, job.quizId]);
  }
  console.log("✅ Queue numbers updated");
}

async function runNextJob() {
  console.log("▶️ runNextJob called, queue length:", queue.length, "isRunning:", isRunning);
  if (isRunning || queue.length === 0) return;
  isRunning = true;

  const job = queue.shift();
  if (!job) {
    console.log("ℹ️ No jobs to run");
    isRunning = false;
    return;
  }

  const { quizId, payload } = job;
  console.log(`🚀 Processing quiz ${quizId}...`);

  try {
    await db.execute(`UPDATE quizzes SET generation_status = 'pending', queue_number = NULL WHERE id = ?`, [quizId]);
    await updateQueueNumbers();
    await new Promise((r) => setTimeout(r, 500));

    const reqClone = new NextRequest("http://localhost/api/internal", { method: "POST", body: payload });
    await processQuiz(reqClone);

    console.log(`✅ Finished processing quiz ${quizId}`);
  } catch (err) {
    console.error(`❌ Error processing quiz ${quizId}:`, err);
    await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
  } finally {
    isRunning = false;
    await updateQueueNumbers();
    console.log("🕓 Scheduling next job...");
    setTimeout(runNextJob, 300);
  }
}

async function enqueueQuizJob(quizId: number, form: FormData) {
  console.log(`📥 enqueueQuizJob called for quiz ${quizId}`);
  if (queue.some((q) => q.quizId === quizId)) {
    console.log(`⚠️ Quiz ${quizId} is already in queue`);
    return;
  }

  queue.push({ quizId, payload: form });
  console.log(`🕒 Quiz ${quizId} queued (position ${queue.length})`);
  await updateQueueNumbers();
  runNextJob();
}

/* -------------------------------------------------------------------------- */
/*                                 POST ROUTE                                 */
/* -------------------------------------------------------------------------- */
export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log("📨 POST /api/quizzes/generate called");
  try {
    const session = await getServerSession(authOptions);
    console.log("🔑 Session:", session ? "Valid" : "Invalid");

    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const quizId = Number(form.get("quizId"));
    const userId = Number(session.user.id);

    console.log("📦 quizId:", quizId, "userId:", userId);

    if (!quizId)
      return NextResponse.json({ error: "Missing quizId" }, { status: 400 });

    const [[{ count }]]: any = await db.query(
      "SELECT COUNT(*) AS count FROM quizzes WHERE generation_status = 'queued'"
    );
    console.log("🧮 Existing queued count:", count);

    const queueNumber = count + 1;
    await db.execute(
      `UPDATE quizzes SET generation_status = 'queued', queue_number = ? WHERE id = ? AND user_id = ?`,
      [queueNumber, quizId, userId]
    );

    console.log(`🟢 Quiz ${quizId} marked as queued (#${queueNumber})`);
    enqueueQuizJob(quizId, form);

    return NextResponse.json({ success: true, status: "queued", quizId, queueNumber });
  } catch (err: any) {
    console.error("❌ Queue enqueue error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
