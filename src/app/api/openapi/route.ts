import { NextResponse } from "next/server";
import { generateOpenApi } from "@/lib/openapi";

export const runtime = "nodejs"; // ✅ required for fs access

export async function GET() {
  const spec = generateOpenApi();
  return NextResponse.json(spec, { status: 200 });
}
