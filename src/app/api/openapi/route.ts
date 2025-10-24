import { NextResponse } from "next/server";
import { generateOpenApi } from "@/lib/openapi";

export const runtime = "nodejs";

// Allowed origins (explicit list of your real domains)
const allowedOrigins = [
  "https://studyjit.swagger.yehorskudilov.com",
  "https://studyjit.yehorskudilov.com",
  "http://localhost:8080",
  "http://localhost:3000",
];

function getCorsOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return allowedOrigins.includes(origin) ? origin : null;
}

// ✅ Handle GET
export async function GET(req: Request) {
  const spec = generateOpenApi();
  const origin = req.headers.get("origin");
  const corsOrigin = getCorsOrigin(origin);

  // Build the response manually (NextResponse sometimes strips headers)
  return new Response(JSON.stringify(spec), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...(corsOrigin
        ? {
            "Access-Control-Allow-Origin": corsOrigin,
            Vary: "Origin",
          }
        : {}),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// ✅ Handle OPTIONS (preflight)
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const corsOrigin = getCorsOrigin(origin);

  return new Response(null, {
    status: 204,
    headers: {
      ...(corsOrigin
        ? {
            "Access-Control-Allow-Origin": corsOrigin,
            Vary: "Origin",
          }
        : {}),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
