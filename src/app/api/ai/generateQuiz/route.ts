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

    if (fileRows.length === 0) {
      throw new Error("No files linked to this quiz");
    }

    // 🧠 Upload files to OpenAI
    const fileIds: string[] = [];
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
    
    // Create assistant with file_search tool
    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o-mini",
      name: "Quiz Generator",
      instructions: `You are a quiz generator. Your job is to:

1. READ THE ACTUAL TEXT CONTENT inside the uploaded documents
2. UNDERSTAND the subject matter, topics, and concepts being discussed
3. CREATE quiz questions about WHAT THE DOCUMENT TEACHES/EXPLAINS

❌ DO NOT create questions about:
- PDF version numbers, format specifications
- File metadata (creation dates, authors, titles)
- Technical document structure (fonts, encodings, objects, streams)
- Page sizes, media boxes, or layout properties

✅ DO create questions about:
- The actual topics and subject matter in the text
- Concepts, definitions, and facts presented in the content
- Key information that someone reading the document would learn

Think of it this way: If a student read this document, what should they know? Ask questions about THAT content, not about the document's technical properties.`,
      tools: [{ type: "file_search" }],
    });

    console.log(`✅ Created assistant: ${assistant.id}`);

    // Create thread with attachments
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: `Generate EXACTLY ${numQuestions} multiple-choice quiz questions.

IMPORTANT: 
- Read the TEXT CONTENT in the uploaded files
- Create questions about the SUBJECT MATTER and TOPICS discussed
- DO NOT ask about PDF metadata, file structure, or technical properties

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "Your question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "Option A"
    }
  ]
}

Quiz Title: ${quizName}
${message ? `Additional Instructions: ${message}` : ""}

Generate ${numQuestions} questions now:`,
          attachments: fileIds.map(file_id => ({
            file_id,
            tools: [{ type: "file_search" as const }],
          })),
        },
      ],
    });

    console.log(`✅ Created thread: ${thread.id}`);

    // Run assistant
    console.log("🤖 Running assistant...");
    const run = await openai.beta.threads.runs.createAndPoll(
      thread.id,
      {
        assistant_id: assistant.id,
      }
    );

    console.log(`✅ Run completed with status: ${run.status}`);

    if (run.status !== "completed") {
      throw new Error(`Assistant run failed with status: ${run.status}`);
    }

    // Get messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    
    if (!lastMessage || lastMessage.role !== "assistant") {
      throw new Error("No assistant response found");
    }

    // Extract text from content blocks
    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") {
        text += block.text.value;
      }
    }

    text = text.trim();

    if (!text) {
      throw new Error("Assistant returned empty response");
    }

    console.log("🔍 Raw response (first 1000 chars):", text.substring(0, 1000));
    console.log("📏 Total response length:", text.length);

    // Parse response
    let parsed: any = null;

    try {
      // Try direct parse
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.log("⚠️ Direct JSON parse failed, trying to extract...");
      
      // Try to extract JSON from markdown
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        console.log("✅ Found JSON in markdown block");
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error("❌ Failed to parse markdown JSON:", e);
        }
      }
      
      if (!parsed) {
        // Try to find any JSON object
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          console.log("✅ Found JSON object in text");
          try {
            parsed = JSON.parse(objectMatch[0]);
          } catch (e) {
            console.error("❌ Failed to parse extracted JSON:", e);
          }
        }
      }
      
      if (!parsed) {
        console.error("❌ Full response text:", text);
        throw new Error("Could not find valid JSON in response. Check server logs for full response.");
      }
    }

    console.log("📦 Parsed structure:", Object.keys(parsed));

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      console.error("❌ Invalid structure. Parsed object:", JSON.stringify(parsed, null, 2));
      throw new Error("Response missing 'questions' array");
    }

    if (parsed.questions.length === 0) {
      throw new Error("Questions array is empty");
    }

    // Format questions
    const formattedQuestions = parsed.questions.map((q: any, idx: number) => ({
      id: q.id || idx + 1,
      question: q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      correct: q.correct || q.answer || "",
    }));

    console.log(`✅ Formatted ${formattedQuestions.length} questions`);
    console.log("📋 First question:", formattedQuestions[0]?.question);

    // Cleanup OpenAI resources
    console.log("🧹 Cleaning up...");
    try {
      await openai.beta.assistants.delete(assistant.id);
      for (const fileId of fileIds) {
        await openai.files.delete(fileId);
      }
    } catch (err) {
      console.warn("⚠️ Cleanup warning:", err);
    }

    // Save to database
    const result = await addQuestionsToQuiz(quizId, formattedQuestions);
    console.log(`💾 Saved ${result.questionCount} questions to database`);

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
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
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