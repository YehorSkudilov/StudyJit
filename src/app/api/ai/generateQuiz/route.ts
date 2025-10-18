import { NextRequest, NextResponse } from "next/server";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";
import { getConnection } from "@/lib/db";
import fs from "fs";
import OpenAI from "openai";

// 🧩 Simple queue so only one quiz is generated at a time
const queue: (() => Promise<void>)[] = [];
let active = false;

async function runNext() {
  if (active || queue.length === 0) return;
  active = true;
  const job = queue.shift()!;
  try {
    await job();
  } catch (err) {
    console.error("❌ Job error:", err);
  } finally {
    active = false;
    runNext();
  }
}

async function processQuiz(req: NextRequest): Promise<NextResponse> {
  const db = await getConnection();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  let quizId = 0;

  try {
    // 🧾 Parse form data
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";
    quizId = Number(form.get("quizId")) || 0;
    const quizName = form.get("quizName")?.toString() || "Untitled Quiz";
    const numQuestions = Number(form.get("numQuestions")) || 10;

    if (!quizId) {
      await db.end();
      return NextResponse.json({ error: "Missing quizId" }, { status: 400 });
    }

    // 🟡 Mark quiz as pending
    await db.execute(`UPDATE quizzes SET generation_status = 'pending' WHERE id = ?`, [quizId]);

    // 📂 Fetch linked files from DB
    const [fileRows]: any = await db.query(
      `
      SELECT f.id, f.name, f.path
      FROM quiz_files qf
      JOIN files f ON qf.file_id = f.id
      WHERE qf.quiz_id = ?
      `,
      [quizId]
    );

    const hasFiles = fileRows.length > 0;
    const hasPrompt = message.trim().length > 0;

    if (!hasFiles && !hasPrompt) {
      console.warn("⚠️ No files or prompt provided. Using general fallback topic.");
    }

    // 🧠 Upload files if available
    const fileIds: string[] = [];
    if (hasFiles) {
      console.log(`📂 Uploading ${fileRows.length} file(s) to OpenAI...`);
      for (const file of fileRows) {
        try {
          const upload = await openai.files.create({
            file: fs.createReadStream(file.path),
            purpose: "assistants",
          });
          fileIds.push(upload.id);
          console.log(`✅ Uploaded ${file.name} → ${upload.id}`);
        } catch (err) {
          console.warn(`⚠️ Failed to upload ${file.name}:`, err);
        }
      }
      console.log(`✅ Uploaded ${fileIds.length} files`);
    }

    // Create assistant with file_search tool if files exist
    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `
You are a quiz generator. Your job is to:

1. Read any uploaded documents (if provided)
2. Understand their subject matter and topics
3. Create quiz questions about what the content teaches
4. If no files or message are provided, generate general-knowledge quiz questions

❌ Do NOT create questions about:
- File metadata, formatting, or technical details

✅ Create questions about:
- The educational content and subject matter
- Facts, definitions, and key ideas someone should learn.`,
      tools: hasFiles ? [{ type: "file_search" }] : [],
    });

    console.log(`✅ Created assistant: ${assistant.id}`);

    // Compose message
    const userMessage =
      hasPrompt || hasFiles
        ? `Generate EXACTLY ${numQuestions} multiple-choice quiz questions.
${hasPrompt ? `Prompt/Instructions: ${message}` : ""}
${hasFiles ? "Use the uploaded files as source material." : ""}
Return valid JSON with the following structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Your question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "Option A"
    }
  ]
}`
        : `Generate ${numQuestions} general knowledge quiz questions in JSON format (same structure as above).`;

    // Create thread
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: userMessage,
          attachments: hasFiles
            ? fileIds.map((file_id) => ({
                file_id,
                tools: [{ type: "file_search" as const }],
              }))
            : [],
        },
      ],
    });

    console.log(`✅ Created thread: ${thread.id}`);

    // Run assistant
    console.log("🤖 Running assistant...");
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });

    if (run.status !== "completed") {
      throw new Error(`Assistant run failed with status: ${run.status}`);
    }

    // Get assistant messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    if (!lastMessage) throw new Error("No assistant response found");

    // Extract text content
    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") text += block.text.value;
    }
    text = text.trim();
    if (!text) throw new Error("Assistant returned empty response");

    // Try to parse JSON
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) parsed = JSON.parse(objectMatch[0]);
      }
    }

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Response missing 'questions' array");
    }

    const formattedQuestions = parsed.questions.map((q: any, i: number) => ({
      id: q.id || i + 1,
      question: q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      correct: q.correct || q.answer || "",
    }));

    console.log(`✅ Formatted ${formattedQuestions.length} questions`);

    // Cleanup
    try {
      await openai.beta.assistants.delete(assistant.id);
      for (const fileId of fileIds) await openai.files.delete(fileId);
    } catch (err) {
      console.warn("⚠️ Cleanup warning:", err);
    }

    // Save to DB
    const result = await addQuestionsToQuiz(quizId, formattedQuestions);
    await db.execute(`UPDATE quizzes SET generation_status = 'success' WHERE id = ?`, [quizId]);

    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    if (quizId > 0) {
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await db.end();
  }
}

// 🧱 Main endpoint (queued)
export async function POST(req: NextRequest): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    queue.push(async () => {
      console.log(`🚀 Starting queued job`);
      const response = await processQuiz(req);
      console.log("✅ Job finished");
      resolve(response);
    });
    runNext();
  });
}
