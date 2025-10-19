import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";
import db from "@/lib/db";
import fs from "fs";
import OpenAI from "openai";

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

const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".doc", ".docx", ".ppt", ".pptx", ".csv", ".json", ".md", ".html", ".xml", ".rtf"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"];

// Enhanced JSON extraction
function extractAndParseJSON(text: string): any {
  console.log("🔍 Attempting to parse response...");
  
  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (parsed?.questions && Array.isArray(parsed.questions)) {
      console.log("✅ Direct JSON parse successful");
      return parsed;
    }
  } catch {}

  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  
  // Try parsing cleaned version
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.questions && Array.isArray(parsed.questions)) {
      console.log("✅ Cleaned JSON parse successful");
      return parsed;
    }
  } catch {}

  // Extract JSON object with questions array
  const jsonPatterns = [
    /\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\]\s*\}/,
    /\{[^{}]*"questions"[^{}]*\[[^\]]*\][^{}]*\}/,
  ];

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        // Handle potential truncation by ensuring proper JSON closure
        let jsonStr = match[0];
        
        // Count braces to detect truncation
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
        
        // Attempt to close unclosed structures
        if (openBrackets > closeBrackets) {
          jsonStr += ']'.repeat(openBrackets - closeBrackets);
        }
        if (openBraces > closeBraces) {
          jsonStr += '}'.repeat(openBraces - closeBraces);
        }
        
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

  // Last resort: extract questions array directly
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

async function processQuiz(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  let quizId = 0;

  try {
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";
    quizId = Number(form.get("quizId")) || 0;
    const quizName = form.get("quizName")?.toString() || "Untitled Quiz";
    const numQuestions = Number(form.get("numQuestions")) || 10;

    if (!quizId) {
      return NextResponse.json({ error: "Missing quizId" }, { status: 400 });
    }

    console.log(`📝 Generating quiz: ${quizName} (${numQuestions} questions)`);

    // Validate ownership
    const [quizRows]: any = await db.query(
      "SELECT id, user_id FROM quizzes WHERE id = ?",
      [quizId]
    );
    
    if (!quizRows.length || quizRows[0].user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    console.log(`📊 ${documentFiles.length} docs, ${imageFiles.length} images, ${audioFiles.length} audio`);

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

    // Create assistant with stricter JSON enforcement
    const tools: any[] = [];
    if (documentFiles.length > 0) tools.push({ type: "file_search" });

    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `You are a quiz generator. You MUST respond with ONLY valid JSON. NO explanations, NO markdown, NO text before or after.

CRITICAL: Your entire response must be a single JSON object starting with { and ending with }

ANALYZE all provided content thoroughly and create questions covering the full breadth of material.

JSON FORMAT (REQUIRED):
{
  "questions": [
    {
      "id": 1,
      "question": "Clear question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "Option A"
    }
  ]
}

RULES:
- Generate EXACTLY the requested number of questions
- Each question has exactly 4 options
- The "correct" field must match one option exactly
- Cover ALL material: main concepts, details, and important facts
- Distribute questions evenly across all content
- NO text outside the JSON object
- NO markdown code blocks
- NO explanations

RESPOND WITH ONLY THE JSON OBJECT.`,
      tools: tools.length > 0 ? tools : undefined,
      response_format: { type: "json_object" }, // Force JSON response
    });

    console.log(`✅ Assistant created: ${assistant.id}`);

    // Build instruction with emphasis on JSON-only output
    let instruction = `Generate ${numQuestions} quiz questions in JSON format.\n\n`;
    
    instruction += `IMPORTANT: Respond with ONLY the JSON object. Start with { and end with }. No other text.\n\n`;

    if (message.trim()) {
      instruction += `Topic: ${message}\n\n`;
    }

    if (documentFiles.length > 0) {
      instruction += `Analyze all ${documentFiles.length} document(s) thoroughly. Create questions covering the full breadth of content.\n\n`;
    }

    if (imageFiles.length > 0) {
      instruction += `Analyze all ${imageFiles.length} image(s). Create questions about visual content.\n\n`;
    }

    if (audioFiles.length > 0) {
      instruction += `Audio transcriptions:\n${audioTranscriptions}\n\n`;
    }

    if (!documentFiles.length && !imageFiles.length && !audioFiles.length) {
      instruction = `Generate ${numQuestions} quiz questions on: "${message || 'general knowledge'}"\n\n`;
    }

    instruction += `Output ONLY this JSON structure:\n{"questions":[{"id":1,"question":"...","options":["A","B","C","D"],"correct":"A"}]}`;

    // Build message content
    const messageContent: any[] = [{ type: "text", text: instruction }];

    // Add images
    for (const fileId of imageFileIds) {
      messageContent.push({
        type: "image_file",
        image_file: { file_id: fileId },
      });
    }

    // Prepare document attachments
    const attachments: any[] = documentFileIds.map(fileId => ({
      file_id: fileId,
      tools: [{ type: "file_search" }],
    }));

    // Create thread
    const thread = await openai.beta.threads.create({
      messages: [{
        role: "user",
        content: messageContent,
        attachments: attachments.length > 0 ? attachments : undefined,
      }],
    });

    console.log(`✅ Thread created: ${thread.id}`);

    // Run assistant with longer timeout for large files
    console.log("🤖 Running assistant...");
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
      max_prompt_tokens: 100000, // Increase token limit for large files
      max_completion_tokens: 16000, // Increase completion tokens
    });

    if (run.status !== "completed") {
      console.error(`❌ Run status: ${run.status}`);
      if (run.last_error) {
        console.error(`❌ Error details:`, run.last_error);
      }
      throw new Error(`Assistant run failed: ${run.status}`);
    }

    // Get response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    if (!lastMessage) throw new Error("No response from assistant");

    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") text += block.text.value;
    }
    text = text.trim();

    console.log("📩 Response length:", text.length);
    console.log("📩 Response preview:", text.substring(0, 500));

    // Enhanced JSON parsing
    const parsed = extractAndParseJSON(text);

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      console.error("❌ Failed to extract valid JSON structure");
      console.error("📄 Full response:", text);
      throw new Error("Could not extract valid questions from response. The file might be too large or complex.");
    }

    if (parsed.questions.length === 0) {
      throw new Error("No questions were generated. Please try with a smaller file or fewer questions.");
    }

    // Format and validate questions
    const formattedQuestions = parsed.questions
      .filter((q: any) => q.question && q.options) // Filter out invalid questions
      .map((q: any, i: number) => ({
        id: q.id || i + 1,
        question: q.question || `Question ${i + 1}`,
        options: Array.isArray(q.options) && q.options.length >= 2
          ? q.options.slice(0, 4) // Limit to 4 options
          : ["Option A", "Option B", "Option C", "Option D"],
        correct: q.correct || q.answer || (Array.isArray(q.options) ? q.options[0] : "Option A"),
      }));

    console.log(`✅ Successfully parsed ${formattedQuestions.length} questions`);

    if (formattedQuestions.length === 0) {
      throw new Error("No valid questions could be extracted from the response.");
    }

    // Cleanup
    try {
      await openai.beta.assistants.delete(assistant.id);
      for (const fileId of [...documentFileIds, ...imageFileIds]) {
        await openai.files.delete(fileId);
      }
    } catch (err) {
      console.warn("⚠️ Cleanup warning:", err);
    }

    // Save to DB
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
    console.error("❌ Stack:", error.stack);
    
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    queue.push(async () => {
      console.log(`🚀 Starting quiz generation`);
      const response = await processQuiz(req);
      console.log("✅ Job finished");
      resolve(response);
    });
    runNext();
  });
}