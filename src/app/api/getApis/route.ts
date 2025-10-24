import { NextResponse } from "next/server";
import { listApiRoutes } from "@/lib/listApiRoutes";

export const runtime = "nodejs"; // ✅ critical

export async function GET() {
  const routes = listApiRoutes();
  return NextResponse.json({ count: routes.length, routes });
}
