import { NextResponse } from "next/server";
import { generateOpenApi } from "@/lib/openapi";

export const runtime = "nodejs";

// Allowed origins
const allowedOrigins = [
  "https://studyjit.swagger.yehorskudilov.com",
  "https://studyjit.yehorskudilov.com",
  "http://localhost:8080",
  "http://localhost:3000",
];

function getCorsOrigin(origin: string | null): string | null {
  return origin && allowedOrigins.includes(origin) ? origin : null;
}

// ✅ Handle GET
export async function GET(req: Request) {
  const spec = generateOpenApi();
  const origin = req.headers.get("origin");
  const corsOrigin = getCorsOrigin(origin);

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
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Length, Content-Type",
    },
  });
}

// ✅ Handle OPTIONS (CORS preflight)
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
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}
