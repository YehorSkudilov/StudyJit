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

// Supported file extensions for file_search (documents only)
const SUPPORTED_EXTENSIONS = [
  '.pdf', '.txt', '.doc', '.docx', '.ppt', '.pptx',
  '.csv', '.json', '.md', '.html', '.xml', '.rtf'
];

// Image extensions that require vision
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

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

    // Separate files by type
    const documentFiles: any[] = [];
    const imageFiles: any[] = [];
    const unsupportedFiles: any[] = [];

    for (const file of fileRows) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        documentFiles.push(file);
      } else if (IMAGE_EXTENSIONS.includes(ext)) {
        imageFiles.push(file);
      } else {
        unsupportedFiles.push(file);
        console.warn(`⚠️ Unsupported file type: ${file.name}`);
      }
    }

    const hasDocuments = documentFiles.length > 0;
    const hasImages = imageFiles.length > 0;
    const hasPrompt = message.trim().length > 0;

    console.log(`📊 Files: ${documentFiles.length} docs, ${imageFiles.length} images, ${unsupportedFiles.length} unsupported`);

    if (!hasDocuments && !hasImages && !hasPrompt) {
      console.warn("⚠️ No valid files or prompt provided. Using general fallback.");
    }

    // 🧠 Upload documents for file_search
    const documentFileIds: string[] = [];
    if (hasDocuments) {
      console.log(`📂 Uploading ${documentFiles.length} document(s) to OpenAI...`);
      for (const file of documentFiles) {
        try {
          const upload = await openai.files.create({
            file: fs.createReadStream(file.path),
            purpose: "assistants",
          });
          documentFileIds.push(upload.id);
          console.log(`✅ Uploaded document ${file.name} → ${upload.id}`);
        } catch (err: any) {
          console.warn(`⚠️ Failed to upload ${file.name}:`, err.message);
        }
      }
      console.log(`✅ Uploaded ${documentFileIds.length} documents`);
    }

    // 📸 Upload images for vision (also as assistant files)
    const imageFileIds: string[] = [];
    if (hasImages) {
      console.log(`📸 Uploading ${imageFiles.length} image(s) for vision...`);
      for (const file of imageFiles) {
        try {
          const upload = await openai.files.create({
            file: fs.createReadStream(file.path),
            purpose: "vision",
          });
          imageFileIds.push(upload.id);
          console.log(`✅ Uploaded image ${file.name} → ${upload.id}`);
        } catch (err: any) {
          console.warn(`⚠️ Failed to upload image ${file.name}:`, err.message);
        }
      }
      console.log(`✅ Uploaded ${imageFileIds.length} images`);
    }

    // Create assistant with appropriate tools
    const tools: any[] = [];
    if (hasDocuments) {
      tools.push({ type: "file_search" });
    }

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
- Generate questions about the actual content/subject matter
- For images: analyze the content and create questions about what's shown
- For documents: create questions about the information and concepts
- If no files provided, generate general knowledge questions`,
      tools: tools.length > 0 ? tools : undefined,
    });

    console.log(`✅ Created assistant: ${assistant.id}`);

    // Compose message content
    const messageContent: any[] = [];
    
    // Add text instruction
    const textInstruction = hasPrompt || hasDocuments || hasImages
      ? `Generate EXACTLY ${numQuestions} multiple-choice quiz questions.

${hasPrompt ? `Topic/Instructions: ${message}` : ""}
${hasDocuments ? "Base questions on the uploaded documents." : ""}
${hasImages ? "Analyze the images and create questions about their content." : ""}

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

    messageContent.push({
      type: "text",
      text: textInstruction
    });

    // Add image file references for vision
    if (hasImages) {
      for (const fileId of imageFileIds) {
        messageContent.push({
          type: "image_file",
          image_file: { file_id: fileId }
        });
      }
    }

    // Prepare attachments for documents
    const attachments: any[] = [];
    if (hasDocuments) {
      for (const fileId of documentFileIds) {
        attachments.push({
          file_id: fileId,
          tools: [{ type: "file_search" }]
        });
      }
    }

    // Create thread with message
    const thread = await openai.beta.threads.create({
      messages: [{
        role: "user",
        content: messageContent,
        attachments: attachments.length > 0 ? attachments : undefined,
      }],
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
      
      // Try to extract from markdown code blocks
      const codeBlockPatterns = [
        /```json\s*([\s\S]*?)\s*```/,
        /```\s*([\s\S]*?)\s*```/,
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
      for (const fileId of [...documentFileIds, ...imageFileIds]) {
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