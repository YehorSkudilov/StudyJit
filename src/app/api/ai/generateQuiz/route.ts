import { NextRequest, NextResponse } from "next/server";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";
    const quizId = Number(form.get("quizId")) || 0;

    if (!quizId) {
      return NextResponse.json(
        { error: "Missing quizId in request" },
        { status: 400 }
      );
    }

    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "deepseek-r1:7b";

    // 🔹 1. Generate quiz questions using Ollama
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
      return NextResponse.json(
        { error: `Ollama API error: ${res.status} ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    let text = (data.response || "").trim();

    // 🧩 Attempt to parse Ollama’s JSON response safely
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

    // ✅ Fallback: handle array-only output
    if (!parsed && text.includes("[")) {
      try {
        parsed = { questions: JSON.parse(text.match(/\[[\s\S]*\]/)![0]) };
      } catch (innerErr) {
        console.error("❌ Fallback array parse failed:", innerErr);
      }
    }

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      console.error("⚠️ Invalid model output:", text.slice(0, 200));
      return NextResponse.json(
        { error: "Model returned invalid JSON", raw: text },
        { status: 500 }
      );
    }

    console.log("✅ Parsed quiz JSON:", parsed);

    // 🔹 2. Replace all questions for this quiz
    const result = await addQuestionsToQuiz(quizId, parsed.questions);

    console.log(`💾 Updated quiz #${quizId} with ${result.questionCount} questions.`);
    return NextResponse.json({
      success: true,
      quizId,
      questionCount: result.questionCount,
    });
  } catch (error: any) {
    console.error("Ollama/DB error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate and update quiz" },
      { status: 500 }
    );
  }
}
