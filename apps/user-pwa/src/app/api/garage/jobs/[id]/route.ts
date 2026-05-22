import { NextResponse } from "next/server";
import { getGarageSession } from "@/lib/auth/session";
import { getGarageJobById } from "@/lib/garage/jobs";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getGarageSession();
  if (!session) {
    return applyCorsHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      request,
    );
  }
  const { id } = await ctx.params;
  const job = await getGarageJobById({ garageId: session.sub, bookingId: id });
  if (!job) {
    return applyCorsHeaders(
      NextResponse.json({ error: "not_found" }, { status: 404 }),
      request,
    );
  }
  return applyCorsHeaders(NextResponse.json({ job }), request);
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
