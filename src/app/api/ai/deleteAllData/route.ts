import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * GET /api/files/deleteAll
 * Deletes all OpenAI uploaded files AND all vector stores via REST API fallback.
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY!;
    const openai = new OpenAI({ apiKey });

    /* ---------------------------------------------------------------------- */
    /*                                FILES                                   */
    /* ---------------------------------------------------------------------- */
    console.log("📂 Fetching all OpenAI uploaded files...");
    const files = await openai.files.list();

    let deletedFileCount = 0;
    if (files.data.length) {
      console.log(`🗑️ Found ${files.data.length} files. Deleting...`);
      for (const file of files.data) {
        try {
          await openai.files.delete(file.id);
          deletedFileCount++;
          console.log(`✅ Deleted file: ${file.filename} (${file.id})`);
        } catch (err: any) {
          console.warn(`⚠️ Could not delete file ${file.id}: ${err.message}`);
        }
      }
    } else {
      console.log("ℹ️ No files found.");
    }

    /* ---------------------------------------------------------------------- */
    /*                             VECTOR STORES                              */
    /* ---------------------------------------------------------------------- */
    console.log("📊 Fetching vector stores (manual REST)...");

    // Manually fetch all vector stores using REST API
    const vsList = await fetch("https://api.openai.com/v1/vector_stores", {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then((r) => r.json());

    if (!vsList?.data?.length) {
      console.log("ℹ️ No vector stores found.");
      return NextResponse.json({
        success: true,
        deletedFiles: deletedFileCount,
        totalFiles: files.data.length,
        deletedVectorStores: 0,
        totalVectorStores: 0,
      });
    }

    let deletedVectorCount = 0;
    console.log(`🗑️ Found ${vsList.data.length} vector stores. Deleting...`);

    for (const vs of vsList.data) {
      try {
        await fetch(`https://api.openai.com/v1/vector_stores/${vs.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        deletedVectorCount++;
        console.log(`✅ Deleted vector store: ${vs.name || vs.id}`);
      } catch (err: any) {
        console.warn(`⚠️ Could not delete vector store ${vs.id}: ${err.message}`);
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                               RESPONSE                                 */
    /* ---------------------------------------------------------------------- */
    const summary = {
      success: true,
      deletedFiles: deletedFileCount,
      totalFiles: files.data.length,
      deletedVectorStores: deletedVectorCount,
      totalVectorStores: vsList.data.length,
    };

    console.log("✅ Cleanup summary:", summary);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("❌ OpenAI cleanup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
