import { NextRequest, NextResponse } from "next/server";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";
import { getConnection } from "@/lib/db";

export async function POST(req: NextRequest) {
  const db = await getConnection();
  let quizId = 0; // ✅ Keep this outside to reuse in catch/finally

  try {
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";
    quizId = Number(form.get("quizId")) || 0;

    if (!quizId) {
      await db.end();
      return NextResponse.json({ error: "Missing quizId in request" }, { status: 400 });
    }

    // 🟡 Mark quiz as "pending"
    await db.execute(`UPDATE quizzes SET generation_status = 'pending' WHERE id = ?`, [quizId]);

    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "deepseek-r1:7b";

    // 🔹 Generate quiz content
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `
You are a quiz generator. Respond only with valid JSON:
{ "questions": [ { "id": 1, "question": "...", "options": ["A","B","C","D"], "correct": "A" } ] }
Each question must have exactly 4 options and one correct answer.

User message:
${message}
        `,
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Ollama returned an error:", text);
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
      return NextResponse.json({ error: `Ollama API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    let text = (data.response || "").trim();

    // 🧩 Parse JSON safely
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (innerErr) {
          console.error("❌ JSON extraction failed:", innerErr);
        }
      }
    }

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      console.error("⚠️ Invalid model output:", text.slice(0, 200));
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
      return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 500 });
    }

    // 🔹 Save questions to DB
    const result = await addQuestionsToQuiz(quizId, parsed.questions);
    console.log(`💾 Updated quiz #${quizId} with ${result.questionCount} questions.`);

    // 🟢 Mark success
    await db.execute(`UPDATE quizzes SET generation_status = 'success' WHERE id = ?`, [quizId]);

    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("❌ Ollama/DB error:", error);
    if (quizId > 0) {
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
    }
    return NextResponse.json({ error: error.message || "Failed to generate quiz" }, { status: 500 });
  } finally {
    await db.end();
  }
}
