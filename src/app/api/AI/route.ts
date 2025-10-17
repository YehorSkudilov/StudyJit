import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";

    // URL for Ollama service (from your .env via docker-compose)
    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "deepseek-r1:7b";

    // 👇 Send prompt to Ollama
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

    const data = await res.json(); // { response: "...", done: true }

    // 🧩 Parse model output into JSON
    let parsed: any;
    try {
      parsed = JSON.parse(data.response);
    } catch {
      const match = data.response.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { error: "Invalid JSON output" };
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Ollama API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
