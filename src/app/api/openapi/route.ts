import { NextResponse } from "next/server";
import { generateOpenApi } from "@/lib/openapi";

export const runtime = "nodejs";

// Define allowed origins explicitly
const allowedOrigins = [
  "https://studyjit.swagger.yehorskudilov.com", // Swagger UI domain
  "https://studyjit.yehorskudilov.com",         // API domain
  "http://localhost:8080",                      // Local dev
  "http://localhost:3000"
];

function getCorsOrigin(origin: string | null): string {
  if (origin && allowedOrigins.includes(origin)) return origin;
  return allowedOrigins[0]; // default to Swagger domain
}

export async function GET(request: Request) {
  const spec = generateOpenApi();
  const origin = request.headers.get("origin");
  const allowedOrigin = getCorsOrigin(origin);

  const res = NextResponse.json(spec, { status: 200 });
  res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return res;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = getCorsOrigin(origin);

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
