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

    console.log(`📝 Generating quiz: ${quizName} (${numQuestions} questions)`);

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

    // Create assistant with improved instructions
    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `You are a quiz generator. Generate multiple-choice quiz questions based on the provided content.

CRITICAL: You MUST respond with ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correct": "A"
    }
  ]
}

Rules:
- Do NOT include any text before or after the JSON
- Do NOT wrap the JSON in markdown code blocks
- Each question must have exactly 4 options
- The "correct" field must match one of the options exactly
- Generate questions about the actual content/subject matter, not file metadata
- If no files provided, generate general knowledge questions`,
      tools: hasFiles ? [{ type: "file_search" }] : [],
    });

    console.log(`✅ Created assistant: ${assistant.id}`);

    // Compose message
    const userMessage = hasPrompt || hasFiles
      ? `Generate EXACTLY ${numQuestions} multiple-choice quiz questions.

${hasPrompt ? `Topic/Instructions: ${message}` : ""}
${hasFiles ? "Base questions on the uploaded files." : ""}

RESPOND WITH ONLY THE JSON OBJECT. NO EXPLANATIONS. NO MARKDOWN.

Format:
{
  "questions": [
    {
      "id": 1,
      "question": "Your question?",
      "options": ["A", "B", "C", "D"],
      "correct": "A"
    }
  ]
}`
      : `Generate ${numQuestions} general knowledge quiz questions. Respond with ONLY the JSON object, no other text.`;

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
    
    console.log("📩 Raw assistant response:");
    console.log(text.substring(0, 500)); // Log first 500 chars for debugging
    
    if (!text) throw new Error("Assistant returned empty response");

    // Enhanced JSON extraction
    let parsed: any = null;
    
    // Try direct parse first
    try {
      parsed = JSON.parse(text);
      console.log("✅ Direct JSON parse successful");
    } catch (e) {
      console.log("⚠️ Direct parse failed, trying extraction...");
      
      // Try to extract from markdown code blocks (```json or ```)
      const codeBlockPatterns = [
        /```json\s*([\s\S]*?)\s*```/,
        /```\s*([\s\S]*?)\s*```/,
        /`([\s\S]*?)`/
      ];
      
      for (const pattern of codeBlockPatterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            parsed = JSON.parse(match[1].trim());
            console.log("✅ Extracted from code block");
            break;
          } catch (e2) {
            continue;
          }
        }
      }
      
      // Try to find JSON object in text
      if (!parsed) {
        const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            console.log("✅ Extracted JSON object from text");
          } catch (e3) {
            console.error("❌ Failed to parse extracted JSON");
          }
        }
      }
    }

    // Validate parsed data
    if (!parsed) {
      throw new Error("Failed to extract valid JSON from response");
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error("❌ Invalid response structure:", parsed);
      throw new Error("Response missing 'questions' array");
    }

    if (parsed.questions.length === 0) {
      throw new Error("Response contains empty questions array");
    }

    // Format and validate questions
    const formattedQuestions = parsed.questions.map((q: any, i: number) => {
      if (!q.question || !Array.isArray(q.options) || !q.correct) {
        console.warn(`⚠️ Invalid question at index ${i}:`, q);
      }
      
      return {
        id: q.id || i + 1,
        question: q.question || `Question ${i + 1}`,
        options: Array.isArray(q.options) && q.options.length >= 2 
          ? q.options 
          : ["Option A", "Option B", "Option C", "Option D"],
        correct: q.correct || q.answer || (q.options?.[0] || "Option A"),
      };
    });

    console.log(`✅ Formatted ${formattedQuestions.length} questions`);

    // Cleanup OpenAI resources
    try {
      await openai.beta.assistants.delete(assistant.id);
      for (const fileId of fileIds) {
        await openai.files.delete(fileId);
      }
      console.log("✅ Cleanup completed");
    } catch (err) {
      console.warn("⚠️ Cleanup warning:", err);
    }

    // Save to DB
    const result = await addQuestionsToQuiz(quizId, formattedQuestions);
    await db.execute(`UPDATE quizzes SET generation_status = 'success' WHERE id = ?`, [quizId]);

    console.log(`✅ Quiz generation complete: ${result.questionCount} questions saved`);

    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("❌ Error during quiz generation:", error);
    console.error("Stack trace:", error.stack);
    
    if (quizId > 0) {
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
    }
    
    return NextResponse.json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  } finally {
    await db.end();
  }
}

// 🧱 Main endpoint (queued)
export async function POST(req: NextRequest): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    queue.push(async () => {
      console.log(`🚀 Starting queued quiz generation job`);
      const response = await processQuiz(req);
      console.log("✅ Job finished");
      resolve(response);
    });
    runNext();
  });
}