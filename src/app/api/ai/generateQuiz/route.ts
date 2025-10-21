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
  // ⚙️ Allow processQuiz to run with or without a real session
  const session = await getServerSession(authOptions).catch(() => null);
  const form = await req.formData();
  const quizId = Number(form.get("quizId")) || 0;

  // Fallback: get user_id directly from DB (since session isn't available in background)
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

    await db.execute(
      `UPDATE quizzes SET generation_status = 'pending' WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    // Fetch linked files
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

    // Upload documents
    const documentFileIds: string[] = [];
    for (const file of documentFiles) {
      try {
        const upload = await openai.files.create({
          file: fs.createReadStream(file.path),
          purpose: "assistants",
        });
        documentFileIds.push(upload.id);
        console.log(`✅ Uploaded ${file.name}`);
      } catch (err: any) {
        console.warn(`⚠️ Upload failed ${file.name}:`, err.message);
      }
    }

    // Upload images
    const imageFileIds: string[] = [];
    for (const file of imageFiles) {
      try {
        const upload = await openai.files.create({
          file: fs.createReadStream(file.path),
          purpose: "vision",
        });
        imageFileIds.push(upload.id);
        console.log(`✅ Uploaded ${file.name}`);
      } catch (err: any) {
        console.warn(`⚠️ Upload failed ${file.name}:`, err.message);
      }
    }

    // Transcribe audio
    let audioTranscriptions = "";
    for (const file of audioFiles) {
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(file.path),
          model: "whisper-1",
        });
        audioTranscriptions += `\n\n[Audio: ${file.name}]\n${transcription.text}`;
        console.log(`✅ Transcribed ${file.name}`);
      } catch (err: any) {
        console.warn(`⚠️ Transcription failed ${file.name}:`, err.message);
      }
    }

    const tools: any[] = [];
    if (documentFiles.length > 0) tools.push({ type: "file_search" });

    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `You are a quiz generator. Respond ONLY with valid JSON. No markdown or text outside the JSON object.`,
      tools: tools.length > 0 ? tools : undefined,
      response_format: { type: "json_object" },
    });

    console.log(`✅ Assistant created: ${assistant.id}`);

    let instruction = `Generate ${numQuestions} quiz questions in JSON format.\n\n`;
    instruction += `Respond with ONLY a single JSON object.\n\n`;
    if (message.trim()) instruction += `Topic: ${message}\n\n`;
    if (documentFiles.length > 0) instruction += `Analyze all documents.\n\n`;
    if (imageFiles.length > 0) instruction += `Analyze all images.\n\n`;
    if (audioFiles.length > 0)
      instruction += `Audio transcriptions:\n${audioTranscriptions}\n\n`;

    instruction += `Output ONLY this JSON structure:\n{"questions":[{"id":1,"question":"...","options":["A","B","C","D"],"correct":"A"}]}`;

    const messageContent: any[] = [{ type: "text", text: instruction }];
    for (const fileId of imageFileIds) {
      messageContent.push({ type: "image_file", image_file: { file_id: fileId } });
    }

    const attachments: any[] = documentFileIds.map((fileId) => ({
      file_id: fileId,
      tools: [{ type: "file_search" }],
    }));

    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: messageContent,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      ],
    });

    console.log(`✅ Thread created: ${thread.id}`);

    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
      max_prompt_tokens: 100000,
      max_completion_tokens: 16000,
    });

    if (run.status !== "completed") {
      throw new Error(`Assistant run failed: ${run.status}`);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    if (!lastMessage) throw new Error("No response from assistant");

    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") text += block.text.value;
    }

    const parsed = extractAndParseJSON(text.trim());
    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Could not extract valid questions from response.");
    }

    const formattedQuestions = parsed.questions
      .filter((q: any) => q.question && q.options)
      .map((q: any, i: number) => ({
        id: q.id || i + 1,
        question: q.question || `Question ${i + 1}`,
        options: Array.isArray(q.options)
          ? q.options.slice(0, 4)
          : ["A", "B", "C", "D"],
        correct: q.correct || q.answer || q.options?.[0] || "A",
      }));

    if (formattedQuestions.length === 0) {
      throw new Error("No valid questions extracted.");
    }

    try {
      await openai.beta.assistants.delete(assistant.id);
      for (const fileId of [...documentFileIds, ...imageFileIds]) {
        await openai.files.delete(fileId);
      }
    } catch (err) {
      console.warn("⚠️ Cleanup warning:", err);
    }

    const result = await addQuestionsToQuiz(quizId, formattedQuestions, userId);
    await db.execute(
      `UPDATE quizzes SET generation_status = 'success' WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    console.log(`✅ Quiz complete: ${result.questionCount} questions saved`);

    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    if (quizId > 0) {
      await db.execute(
        `UPDATE quizzes SET generation_status = 'failed' WHERE id = ? AND user_id = ?`,
        [quizId, userId]
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                           CONCURRENT QUEUE SYSTEM (FIXED)                  */
/* -------------------------------------------------------------------------- */

type QuizJob = {
  quizId: number;
  payload: FormData;
};

const queue: QuizJob[] = [];
let isRunning = false;

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
    // ✅ Immediately mark as pending before processing
    const [rows]: any = await db.query(
      "SELECT user_id FROM quizzes WHERE id = ?",
      [quizId]
    );
    if (rows.length > 0) {
      await db.execute(
        "UPDATE quizzes SET generation_status = 'pending' WHERE id = ? AND user_id = ?",
        [quizId, rows[0].user_id]
      );
    }

    // Small delay to ensure frontend catches the pending state
    await new Promise((r) => setTimeout(r, 1000));

    const reqClone = new NextRequest("http://localhost/api/internal", {
      method: "POST",
      body: payload,
    });

    await processQuiz(reqClone);
    console.log(`✅ Finished quiz generation: ${quizId}`);
  } catch (err) {
    console.error(`❌ Quiz ${quizId} failed:`, err);
    try {
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [
        quizId,
      ]);
    } catch (e) {
      console.error("⚠️ Could not mark quiz as failed:", e);
    }
  } finally {
    isRunning = false;
    setTimeout(runNextJob, 250); // trigger next job
  }
}

async function enqueueQuizJob(quizId: number, form: FormData) {
  const alreadyInQueue = queue.some((q) => q.quizId === quizId);
  if (alreadyInQueue) {
    console.warn(`⚠️ Quiz ${quizId} already queued. Skipping.`);
    return;
  }

  queue.push({ quizId, payload: form });
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

    // Mark as queued in DB (not pending yet)
    await db.execute(
      `UPDATE quizzes SET generation_status = 'queued' WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    enqueueQuizJob(quizId, form);
    return NextResponse.json({ success: true, status: "queued", quizId });
  } catch (err: any) {
    console.error("❌ Failed to enqueue quiz job:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
