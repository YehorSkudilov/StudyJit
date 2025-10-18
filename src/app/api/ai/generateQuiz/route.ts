import { NextRequest, NextResponse } from "next/server";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";
import { getConnection } from "@/lib/db";
import fs from "fs";
import OpenAI from "openai";

// 🧩 Simple queue to avoid concurrent quiz generation
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

// 🧠 Core logic
async function processQuiz(req: NextRequest): Promise<NextResponse> {
  const db = await getConnection();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  let quizId = 0;

  try {
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";
    quizId = Number(form.get("quizId")) || 0;
    const quizName = form.get("quizName")?.toString() || "Untitled Quiz";

    if (!quizId) {
      await db.end();
      return NextResponse.json({ error: "Missing quizId" }, { status: 400 });
    }

    // 🟡 Mark pending
    await db.execute(`UPDATE quizzes SET generation_status = 'pending' WHERE id = ?`, [quizId]);

    // 📂 Get linked files
    const [fileRows]: any = await db.query(
      `
      SELECT f.id, f.name, f.path
      FROM quiz_files qf
      JOIN files f ON qf.file_id = f.id
      WHERE qf.quiz_id = ?
      `,
      [quizId]
    );

    // 📄 Read file contents (text only, skip binaries)
    let fileContext = "";
    for (const file of fileRows) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (["txt", "md", "csv", "json"].includes(ext)) {
        try {
          const content = fs.readFileSync(file.path, "utf8");
          fileContext += `\n\n# File: ${file.name}\n${content.slice(0, 3000)}`;
        } catch (err) {
          console.warn(`⚠️ Could not read ${file.name}:`, err);
        }
      } else {
        fileContext += `\n\n# File: ${file.name}\n(Unsupported type: ${ext})`;
      }
    }

    // 🧠 Construct prompt
    const prompt = `
You are a professional quiz generator.
Using the context below, create JSON with questions like:

{
  "questions": [
    { "id": 1, "question": "What is 2 + 2?", "options": ["1","2","3","4"], "correct": "4" }
  ]
}

Rules:
- Exactly 4 options per question.
- JSON only, no extra text.

User message: ${message}
Quiz title: ${quizName}

Attached file contents:
${fileContext || "(No files)"}
`;

    console.log("🧠 Sending prompt to GPT-5-mini…");

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      temperature: 0.7,
    });

    const text = response.output_text?.trim() || "";
    let parsed: any = null;

    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (innerErr) {
          console.error("❌ JSON parsing failed:", innerErr);
        }
      }
    }

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      console.error("⚠️ Invalid GPT output:", text.slice(0, 200));
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
      return NextResponse.json({ error: "Invalid GPT output" }, { status: 500 });
    }

    const result = await addQuestionsToQuiz(quizId, parsed.questions);
    console.log(`💾 Saved ${result.questionCount} questions for quiz #${quizId}`);

    await db.execute(`UPDATE quizzes SET generation_status = 'success' WHERE id = ?`, [quizId]);

    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("❌ GPT/DB error:", error);
    if (quizId > 0)
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
    return NextResponse.json({ error: error.message || "Failed to generate quiz" }, { status: 500 });
  } finally {
    await db.end();
  }
}

// 🧱 Main endpoint (with queue)
export async function POST(req: NextRequest): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    queue.push(async () => {
      console.log(`🚀 Starting queued job #${queue.length + 1}`);
      const response = await processQuiz(req);
      console.log("✅ Job finished");
      resolve(response);
    });
    runNext();
  });
}
