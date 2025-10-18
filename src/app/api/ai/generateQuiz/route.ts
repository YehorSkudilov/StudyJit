import { NextRequest, NextResponse } from "next/server";
import { addQuestionsToQuiz } from "@/lib/addQuestionsToQuiz";
import { getConnection } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse"; // ✅ v2 API
import Tesseract from "tesseract.js";
import mammoth from "mammoth"; // ✅ DOCX to text
// Optional: enable image enhancement if needed later
// import sharp from "sharp";

export async function POST(req: NextRequest) {
  const db = await getConnection();
  let quizId = 0;

  try {
    const form = await req.formData();
    const message = form.get("message")?.toString() || "";
    quizId = Number(form.get("quizId")) || 0;

    if (!quizId) {
      await db.end();
      return NextResponse.json(
        { error: "Missing quizId in request" },
        { status: 400 }
      );
    }

    // 🟡 Mark quiz as pending
    await db.execute(
      `UPDATE quizzes SET generation_status = 'pending' WHERE id = ?`,
      [quizId]
    );

    // 📂 Fetch linked files
    const [fileRows]: any = await db.query(
      `
      SELECT f.path, f.name
      FROM quiz_files qf
      JOIN files f ON qf.file_id = f.id
      WHERE qf.quiz_id = ?
      `,
      [quizId]
    );

    let fileContext = "";

    if (fileRows.length > 0) {
      console.log(`📂 Found ${fileRows.length} linked file(s) for quiz #${quizId}`);

      for (const file of fileRows) {
        const ext = path.extname(file.name).toLowerCase();
        try {
          // ✅ Plain text, Markdown, CSV, JSON
          if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
            const content = await fs.readFile(file.path, "utf8");
            fileContext += `\n\n# File: ${file.name}\n${content}`;
          }

          // ✅ Word Documents (.docx)
          else if (ext === ".docx") {
            console.log(`📄 Extracting text from Word doc: ${file.name}`);
            const buffer = await fs.readFile(file.path);
            const { value } = await mammoth.extractRawText({ buffer });
            fileContext += `\n\n# File: ${file.name}\n${value.trim()}`;
          }

          // ✅ PDF Extraction (text + tables + images + OCR)
          else if (ext === ".pdf") {
            console.log(`📘 Parsing PDF: ${file.name}`);
            const buffer = await fs.readFile(file.path);
            const parser = new PDFParse({ data: buffer });

            // 🔹 Extract text
            const textResult = await parser.getText();
            const text = textResult.text?.trim() || "";

            // 🔹 Extract tables
            const tableResult = await parser.getTable();
            let tableText = "";
            for (const page of tableResult.pages) {
              for (const table of page.tables || []) {
                const rows = (table as unknown as string[][])
                  .map((row) => row.join(" | "))
                  .join("\n");
                tableText += "\n" + rows;
              }
            }

            // 🔹 Extract images + OCR
            const imageResult = await parser.getImage({ imageThreshold: 10 }); // lower threshold
            const pagesWithImages = imageResult.pages.filter(
              (p: any) => p.images?.length > 0
            );

            let ocrText = "";
            if (pagesWithImages.length > 0) {
              console.log(`🖼️ Found ${pagesWithImages.length} image page(s) in ${file.name}`);
              for (const page of pagesWithImages) {
                for (const img of page.images) {
                  try {
                    const bufferImg = Buffer.from(img.data);

                    // Optional: enhance image before OCR
                    // const processedImg = await sharp(bufferImg)
                    //   .grayscale()
                    //   .normalize()
                    //   .toBuffer();

                    const result = await Tesseract.recognize(bufferImg, "eng");
                    const detected = result.data.text.trim();

                    if (detected) {
                      console.log(`🧾 OCR detected text on page ${page.pageNumber}:`, detected.slice(0, 80));
                      ocrText += "\n" + detected;
                    } else {
                      console.warn(`⚠️ OCR returned empty text for ${file.name} page ${page.pageNumber}`);
                    }
                  } catch (ocrErr) {
                    console.warn(`⚠️ OCR failed for ${file.name} page ${page.pageNumber}:`, ocrErr);
                  }
                }
              }
            } else {
              console.warn(`⚠️ No embedded images found in ${file.name}`);
            }

            await parser.destroy();

            // ✅ Combine all text sources
            const combinedText = [text, tableText, ocrText].filter(Boolean).join("\n");
            if (!combinedText) {
              console.warn(`⚠️ No extractable content found in PDF: ${file.name}`);
            }

            fileContext += `\n\n# File: ${file.name}\n${combinedText || "(⚠️ No extractable text/images/tables found)"}`;
          }

          // ✅ Image OCR
          else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
            console.log(`🖼️ Running OCR on image: ${file.name}`);
            const buffer = await fs.readFile(file.path);
            const result = await Tesseract.recognize(buffer, "eng");
            const ocrText = result.data.text.trim();
            if (!ocrText) {
              console.warn(`⚠️ No text detected in image: ${file.name}`);
            }
            fileContext += `\n\n# File: ${file.name}\n${
              ocrText || "(⚠️ No text detected in image)"
            }`;
          }

          // ⚠️ Unsupported files
          else {
            console.warn(`⚠️ Unsupported file type for quiz input: ${file.name}`);
            fileContext += `\n\n# File: ${file.name}\n(⚠️ Unsupported file type: ${ext})`;
          }
        } catch (err) {
          console.warn(`⚠️ Failed to process ${file.name}:`, err);
const message =
  err instanceof Error ? err.message : JSON.stringify(err);
fileContext += `\n\n# File: ${file.name}\n(⚠️ Error processing file: ${message})`;
        }
      }
    } else {
      console.warn(`⚠️ No files linked to quiz #${quizId}`);
    }

    // 🧠 Build prompt for AI
    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "deepseek-r1:7b";

    const fullPrompt = `
You are a quiz generator. Respond only with valid JSON:
{
  "questions": [
    { "id": 1, "question": "...", "options": ["A","B","C","D"], "correct": "A" }
  ]
}
Each question must have exactly 4 options and one correct answer.

## User message:
${message}

## Attached file contents:
${fileContext || "(no attached files)"}
`;

    console.log(`🧠 Sending prompt to Ollama model: ${model}`);
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Ollama returned an error:", text);
      await db.execute(`UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`, [quizId]);
      return NextResponse.json(
        { error: `Ollama API error: ${res.status}` },
        { status: res.status }
      );
    }

    // 🧩 Parse JSON output
    const data = await res.json();
    let text = (data.response || "").trim();
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
      await db.execute(
        `UPDATE quizzes SET generation_status = 'failed' WHERE id = ?`,
        [quizId]
      );
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 500 }
      );
    }

    // 💾 Save questions
    const result = await addQuestionsToQuiz(quizId, parsed.questions);
    console.log(`💾 Saved ${result.questionCount} questions for quiz #${quizId}`);

    // ✅ Mark success
    await db.execute(
      `UPDATE quizzes SET generation_status = 'success' WHERE id = ?`,
      [quizId]
    );

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
    return NextResponse.json(
      { error: error.message || "Failed to generate quiz" },
      { status: 500 }
    );
  } finally {
    await db.end();
  }
}
