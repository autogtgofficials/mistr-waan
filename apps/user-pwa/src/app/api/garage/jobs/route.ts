import { NextResponse } from "next/server";
import { getGarageSession } from "@/lib/auth/session";
import { listGarageJobs } from "@/lib/garage/jobs";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

/** GET /api/garage/jobs — every booking assigned to this garage, newest first. */
export async function GET(request: Request) {
  const session = await getGarageSession();
  if (!session) {
    return applyCorsHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      request,
    );
  }
  const jobs = await listGarageJobs(session.sub);
  return applyCorsHeaders(NextResponse.json({ jobs }), request);
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
