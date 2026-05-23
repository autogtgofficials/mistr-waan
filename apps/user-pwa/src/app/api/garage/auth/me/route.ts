import { NextResponse } from "next/server";
import { getGarageSession } from "@/lib/auth/session";
import { getGarageById } from "@/lib/garage/data";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

/**
 * GET /api/garage/auth/me
 *
 * Returns the current garage session + the garage row. Used by the garage
 * PWA on mount to decide if the user is signed in.
 */
export async function GET(request: Request) {
  const session = await getGarageSession();
  if (!session) {
    return applyCorsHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      request,
    );
  }
  const garage = await getGarageById(session.sub);
  if (!garage) {
    return applyCorsHeaders(
      NextResponse.json({ error: "garage_not_found" }, { status: 404 }),
      request,
    );
  }
  return applyCorsHeaders(NextResponse.json({ garage }), request);
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
