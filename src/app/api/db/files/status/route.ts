import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = decodeURIComponent(searchParams.get("name") || "");
    if (!filename) {
      return NextResponse.json({ bytes: 0 });
    }

    const filePath = path.join("/shared-files", filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ bytes: 0 });
    }

    const stats = await fs.promises.stat(filePath);
    return NextResponse.json({ bytes: stats.size });
  } catch (err: any) {
    console.error("❌ Status route error:", err);
    return NextResponse.json({ bytes: 0 });
  }
}
