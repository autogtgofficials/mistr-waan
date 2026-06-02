import { NextResponse } from "next/server";
import { getGarageSession } from "@/lib/auth/session";
import { getGarageEarnings } from "@/lib/garage/earnings";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

/**
 * GET /api/garage/earnings — aggregated net earnings + commission owed for the
 * signed-in garage. Read-only; used by the garage PWA earnings screen.
 */
export async function GET(request: Request) {
  const session = await getGarageSession();
  if (!session) {
    return applyCorsHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      request,
    );
  }
  const earnings = await getGarageEarnings(session.sub);
  return applyCorsHeaders(NextResponse.json({ earnings }), request);
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
