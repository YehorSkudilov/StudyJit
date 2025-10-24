import { NextResponse } from "next/server";
import { generateOpenApi } from "@/lib/openapi";

export const runtime = "nodejs"; // ✅ required for fs access

// ✅ Handle GET requests
export async function GET() {
  const spec = generateOpenApi();

  const res = NextResponse.json(spec, { status: 200 });

  // Add CORS headers so Swagger UI can fetch it from any origin
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return res;
}

// ✅ Handle preflight OPTIONS requests (CORS)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
