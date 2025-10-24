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

    const allFiles: any[] = [];
    let after: string | undefined;

    // paginate until no more pages
    while (true) {
      const res = await openai.files.list({ after });
      allFiles.push(...res.data);

      if (!res.has_more) break;
      after = res.data[res.data.length - 1]?.id; // use last file’s id as next cursor
    }

    console.log(`🗂️ Total files found: ${allFiles.length}`);

    let deletedFileCount = 0;
    for (const file of allFiles) {
      try {
        await openai.files.delete(file.id);
        deletedFileCount++;
        console.log(`✅ Deleted file: ${file.filename || file.id}`);
      } catch (err: any) {
        console.warn(`⚠️ Could not delete file ${file.id}: ${err.message}`);
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                             VECTOR STORES                              */
    /* ---------------------------------------------------------------------- */
    console.log("📊 Fetching all vector stores (manual REST)...");

    const allVectorStores: any[] = [];
    let vsAfter: string | undefined;

    while (true) {
      const url = new URL("https://api.openai.com/v1/vector_stores");
      if (vsAfter) url.searchParams.set("after", vsAfter);

      const vsResponse = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
      }).then((r) => r.json());

      if (!vsResponse?.data?.length) break;

      allVectorStores.push(...vsResponse.data);
      if (!vsResponse.has_more) break;

      vsAfter = vsResponse.data[vsResponse.data.length - 1]?.id;
    }

    console.log(`🗂️ Total vector stores found: ${allVectorStores.length}`);

    let deletedVectorCount = 0;
    for (const vs of allVectorStores) {
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
      totalFiles: allFiles.length,
      deletedVectorStores: deletedVectorCount,
      totalVectorStores: allVectorStores.length,
    };

    console.log("✅ Cleanup summary:", summary);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("❌ OpenAI cleanup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
