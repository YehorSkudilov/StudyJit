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

    // Create assistant
    const tools: any[] = [];
    if (documentFiles.length > 0) tools.push({ type: "file_search" });

    const assistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: "Quiz Generator",
      instructions: `You are an expert quiz generator. Your task is to create comprehensive, well-distributed quiz questions that thoroughly cover ALL the material provided.

CRITICAL INSTRUCTIONS:
1. Analyze ALL provided content (documents, images, audio transcriptions) completely
2. Create questions that cover the ENTIRE breadth of the material, not just highlights
3. Distribute questions evenly across all topics, sections, and concepts
4. Include questions about:
   - Main concepts and key ideas
   - Important details and facts
   - Relationships and connections between topics
   - Applications and examples
   - Visual content (for images)
   - Definitions and terminology

QUESTION QUALITY RULES:
- Each question must be clear, unambiguous, and answerable from the material
- Options must be plausible and of similar length/complexity
- Avoid "all of the above" or "none of the above" options
- Mix difficulty levels: some easier recall questions, some deeper understanding
- For images: ask about specific visual elements, patterns, or information shown
- For audio: cover the main points and important details from transcriptions

OUTPUT FORMAT (CRITICAL):
Respond with ONLY valid JSON. NO explanations. NO markdown. NO code blocks.

{
  "questions": [
    {
      "id": 1,
      "question": "Clear, specific question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "Option A"
    }
  ]
}

REQUIREMENTS:
- Generate EXACTLY the requested number of questions
- Each question MUST have exactly 4 options
- The "correct" field must match one option exactly
- Cover ALL material comprehensively, not just selected highlights`,
      tools: tools.length > 0 ? tools : undefined,
    });

    console.log(`✅ Assistant created: ${assistant.id}`);

    // Build comprehensive instruction
    let instruction = `Generate EXACTLY ${numQuestions} multiple-choice questions that comprehensively cover ALL the material provided below.\n\n`;
    
    instruction += `COVERAGE REQUIREMENTS:\n`;
    instruction += `- Distribute questions evenly across ALL topics and sections\n`;
    instruction += `- Cover main ideas, supporting details, and important facts\n`;
    instruction += `- Include questions from beginning, middle, and end of content\n`;
    instruction += `- Don't focus only on highlights - cover the full breadth\n\n`;

    if (message.trim()) {
      instruction += `TOPIC/FOCUS: ${message}\n\n`;
    }

    if (documentFiles.length > 0) {
      instruction += `DOCUMENTS PROVIDED: ${documentFiles.length} file(s)\n`;
      instruction += `- Analyze ALL documents thoroughly\n`;
      instruction += `- Create questions covering information from ALL documents\n`;
      instruction += `- Ensure comprehensive coverage of all document content\n\n`;
    }

    if (imageFiles.length > 0) {
      instruction += `IMAGES PROVIDED: ${imageFiles.length} image(s)\n`;
      instruction += `- Analyze each image carefully\n`;
      instruction += `- Create questions about visual elements, patterns, text, and content\n`;
      instruction += `- Cover information from ALL images provided\n\n`;
    }

    if (audioFiles.length > 0) {
      instruction += `AUDIO TRANSCRIPTIONS:\n${audioTranscriptions}\n\n`;
      instruction += `- Create questions covering the full audio content\n`;
      instruction += `- Include main points and important details from transcriptions\n\n`;
    }

    if (!documentFiles.length && !imageFiles.length && !audioFiles.length) {
      instruction = `Generate ${numQuestions} general knowledge quiz questions on the topic: "${message || 'general knowledge'}".\n\n`;
    }

    instruction += `RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.\n\nJSON FORMAT:\n{\n  "questions": [\n    {\n      "id": 1,\n      "question": "Question text?",\n      "options": ["A", "B", "C", "D"],\n      "correct": "A"\n    }\n  ]\n}`;

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

    // Run assistant
    console.log("🤖 Running assistant...");
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });

    if (run.status !== "completed") {
      throw new Error(`Assistant run failed: ${run.status}`);
    }

    // Get response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    if (!lastMessage) throw new Error("No response");

    let text = "";
    for (const block of lastMessage.content) {
      if (block.type === "text") text += block.text.value;
    }
    text = text.trim();

    console.log("📩 Response preview:", text.substring(0, 300));

    // Parse JSON
    let parsed: any = null;

    try {
      parsed = JSON.parse(text);
    } catch {
      // Extract from code blocks
      const patterns = [/```json\s*([\s\S]*?)\s*```/, /```\s*([\s\S]*?)\s*```/];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            parsed = JSON.parse(match[1].trim());
            break;
          } catch {}
        }
      }

      // Extract JSON object
      if (!parsed) {
        const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }
    }

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid response structure");
    }

    if (parsed.questions.length === 0) {
      throw new Error("No questions generated");
    }

    const formattedQuestions = parsed.questions.map((q: any, i: number) => ({
      id: q.id || i + 1,
      question: q.question || `Question ${i + 1}`,
      options: Array.isArray(q.options) && q.options.length >= 2
        ? q.options
        : ["Option A", "Option B", "Option C", "Option D"],
      correct: q.correct || q.answer || q.options?.[0] || "Option A",
    }));

    console.log(`✅ Generated ${formattedQuestions.length} questions`);

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
    
    if (quizId > 0) {
      await db.execute(
        `UPDATE quizzes SET generation_status = 'failed' WHERE id = ? AND user_id = ?`,
        [quizId, userId]
      );
    }
    
    return NextResponse.json(
      { error: error.message },
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