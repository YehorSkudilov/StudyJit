import { NextRequest, NextResponse } from "next/server";
import { generateOpenApi } from "@/lib/openapi";

export const runtime = "nodejs";

const allowedOrigins = [
  "https://studyjit.swagger.yehorskudilov.com",
  "https://studyjit.yehorskudilov.com",
  "http://localhost:8080",
  "http://localhost:3000",
];

function getCorsOrigin(origin: string | null): string | null {
  return origin && allowedOrigins.includes(origin) ? origin : null;
}

function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const corsOrigin = getCorsOrigin(origin);

  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  
  if (corsOrigin) {
    response.headers.set("Access-Control-Allow-Origin", corsOrigin);
    response.headers.set("Vary", "Origin");
  } else {
    // fallback for validators / no-origin fetches
    response.headers.set("Access-Control-Allow-Origin", "*");
  }

  return response;
}

/* -------------------------------------------------------------------------- */
/*                                   GET                                      */
/* -------------------------------------------------------------------------- */
export async function GET(req: NextRequest) {
  const spec = generateOpenApi();
  const origin = req.headers.get("origin");

  const response = NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Expose-Headers": "Content-Length, Content-Type",
    },
  });

  return addCorsHeaders(response, origin);
}

/* -------------------------------------------------------------------------- */
/*                                 OPTIONS (CORS)                             */
/* -------------------------------------------------------------------------- */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");

  const response = new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Max-Age": "86400",
    },
  });

  return addCorsHeaders(response, origin);
}