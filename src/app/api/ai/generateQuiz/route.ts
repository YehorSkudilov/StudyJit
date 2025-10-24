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
  try {
    const parsed = JSON.parse(text);
    if (parsed?.questions && Array.isArray(parsed.questions)) return parsed;
  } catch {}
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.questions && Array.isArray(parsed.questions)) return parsed;
  } catch {}
  const jsonMatch = text.match(/\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                           MAIN PROCESS FUNCTION                            */
/* -------------------------------------------------------------------------- */
async function processQuiz(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const quizId = Number(form.get("quizId")) || 0;

  const [quizRows]: any = await db.query("SELECT id, user_id FROM quizzes WHERE id = ?", [quizId]);
  if (!quizRows.length) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const userId = Number(quizRows[0].user_id);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  let vectorStoreId: string | null = null;
  let documentFileIds: string[] = [];
  let assistantId: string | null = null;

  try {
    const message = form.get("message")?.toString() || "";
    const quizName = form.get("quizName")?.toString() || "Untitled Quiz";
    const numQuestions = Number(form.get("numQuestions")) || 10;

    console.log(`📝 Generating quiz: ${quizName} (${numQuestions} questions)`);

    // Immediately mark as pending (processing)
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

    console.log(`📊 Files → ${documentFiles.length} docs, ${imageFiles.length} imgs, ${audioFiles.length} audio`);

    // Create a custom vector store if we have documents
    if (documentFiles.length > 0) {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const vectorStoreName = `user_${userId}_quiz_${quizId}_${timestamp}_${randomSuffix}`;
      
      vectorStoreId = (await openai.vectorStores.create({
        name: vectorStoreName,
      })).id;
      
      console.log(`🗄️ Created vector store: ${vectorStoreId}`);

      // Upload files and add them to the vector store
      for (const file of documentFiles) {
        try {
          const upload = await openai.files.create({
            file: fs.createReadStream(file.path),
            purpose: "assistants",
          });
          documentFileIds.push(upload.id);
          console.log(`✅ Uploaded ${file.name} → ${upload.id}`);
        } catch (err: any) {
          console.warn(`⚠️ Upload failed for ${file.name}: ${err.message}`);
        }
      }

      // Add all uploaded files to the vector store
      if (documentFileIds.length > 0) {
        await openai.vectorStores.fileBatches.create(vectorStoreId, {
          file_ids: documentFileIds,
        });
        console.log(`📎 Added ${documentFileIds.length} files to vector store`);

        // Wait for vector store to be ready
        let vsStatus = await openai.vectorStores.retrieve(vectorStoreId);
        let attempts = 0;
        while (vsStatus.status === "in_progress" && attempts < 30) {
          await new Promise(r => setTimeout(r, 1000));
          vsStatus = await openai.vectorStores.retrieve(vectorStoreId);
          attempts++;
        }
        console.log(`✅ Vector store ready (status: ${vsStatus.status})`);
      }
    }

    // Create assistant with file_search tool configured to use our vector store
    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `Generate ${numQuestions} quiz questions in valid JSON format based on the provided files and topic.`,
      tools: vectorStoreId ? [{ type: "file_search" }] : [],
      tool_resources: vectorStoreId ? {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      } : undefined,
      response_format: { type: "json_object" },
    });
    assistantId = assistant.id;

    // Build instruction text
    let instruction = `Generate ${numQuestions} quiz questions.`;
    if (message) instruction += `\nTopic: ${message}`;
    if (documentFileIds.length > 0) {
      instruction += `\n\nUse the attached files as the primary source material for generating questions.`;
    }
    instruction += `\n\nRespond ONLY in JSON format like:\n{"questions":[{"id":1,"question":"...","options":["A","B","C","D"],"correct":"A"}]}`;

    // Create message content array
    const messageContent: any[] = [{ type: "text", text: instruction }];

    // Add image files as content (vision API)
    for (const imgFile of imageFiles) {
      try {
        const base64 = fs.readFileSync(imgFile.path, { encoding: "base64" });
        const ext = imgFile.name.substring(imgFile.name.lastIndexOf(".")).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        messageContent.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        });
        console.log(`🖼️ Added image ${imgFile.name} to message`);
      } catch (err: any) {
        console.warn(`⚠️ Failed to read image ${imgFile.name}: ${err.message}`);
      }
    }

    // Create thread with message (no attachments needed - files are in vector store)
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    console.log(`🧵 Created thread ${thread.id}`);

    // Run the assistant
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });

    if (run.status !== "completed") throw new Error(`Assistant run failed: ${run.status}`);

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    if (!lastMessage) throw new Error("No assistant response received.");

    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") text += block.text.value;
    }

    const parsed = extractAndParseJSON(text.trim());
    if (!parsed?.questions) throw new Error("Could not parse questions from response.");

    const formatted = parsed.questions.map((q: any, i: number) => ({
      id: q.id || i + 1,
      question: q.question,
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : ["A", "B", "C", "D"],
      correct: q.correct || q.answer || q.options?.[0] || "A",
    }));

    await addQuestionsToQuiz(quizId, formatted, userId);

    await db.execute(
      `UPDATE quizzes SET generation_status = 'success', queue_number = NULL WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );

    console.log(`✅ Quiz ${quizId} successfully generated (${formatted.length} questions).`);
    return NextResponse.json({ success: true, quizId, questionCount: formatted.length });
  } catch (error: any) {
    console.error("❌ Generation error:", error);
    await db.execute(
      `UPDATE quizzes SET generation_status = 'failed', queue_number = NULL WHERE id = ? AND user_id = ?`,
      [quizId, userId]
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    // Cleanup: delete uploaded files
    for (const fileId of documentFileIds) {
      try {
        await openai.files.delete(fileId);
        console.log(`🗑️ Deleted file ${fileId}`);
      } catch (err) {
        console.warn(`⚠️ Failed to delete file ${fileId}`);
      }
    }

    // Cleanup: delete vector store (this also removes file associations)
    if (vectorStoreId) {
      try {
        await openai.vectorStores.delete(vectorStoreId);
        console.log(`🗑️ Deleted vector store ${vectorStoreId}`);
      } catch (err) {
        console.warn(`⚠️ Failed to delete vector store ${vectorStoreId}`);
      }
    }

    // Cleanup: delete assistant
    if (assistantId) {
      try {
        await openai.beta.assistants.delete(assistantId);
        console.log(`🗑️ Deleted assistant ${assistantId}`);
      } catch (err) {
        console.warn(`⚠️ Failed to delete assistant ${assistantId}`);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                           QUEUE MANAGEMENT SYSTEM                          */
/* -------------------------------------------------------------------------- */
type QuizJob = { quizId: number; payload: FormData };
const queue: QuizJob[] = [];
let isRunning = false;

async function updateQueueNumbers() {
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    await db.execute(`UPDATE quizzes SET queue_number = ? WHERE id = ?`, [i + 1, job.quizId]);
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
  console.log(`🚀 Processing quiz ${quizId}`);

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
    setTimeout(runNextJob, 300);
  }
}

async function enqueueQuizJob(quizId: number, form: FormData) {
  if (queue.some((q) => q.quizId === quizId)) return;

  queue.push({ quizId, payload: form });
  await updateQueueNumbers();
  console.log(`🕒 Quiz ${quizId} queued (position ${queue.length})`);
  runNextJob();
}

/* -------------------------------------------------------------------------- */
/*                                 POST ROUTE                                 */
/* -------------------------------------------------------------------------- */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const quizId = Number(form.get("quizId"));
    const userId = Number(session.user.id);

    if (!quizId)
      return NextResponse.json({ error: "Missing quizId" }, { status: 400 });

    const [[{ count }]]: any = await db.query(
      "SELECT COUNT(*) AS count FROM quizzes WHERE generation_status = 'queued'"
    );

    const queueNumber = count + 1;
    await db.execute(
      `UPDATE quizzes SET generation_status = 'queued', queue_number = ? WHERE id = ? AND user_id = ?`,
      [queueNumber, quizId, userId]
    );

    enqueueQuizJob(quizId, form);
    return NextResponse.json({ success: true, status: "queued", quizId, queueNumber });
  } catch (err: any) {
    console.error("❌ Queue enqueue error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}