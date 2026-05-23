import { NextResponse } from "next/server";
import { clearSessionCookie, getGarageSession } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getGarageSession();
  await clearSessionCookie("garage", { crossSubdomain: true });
  if (session) {
    await appendAuditEntry({
      action: "garage_signout",
      entityType: "garage",
      entityId: session.sub,
      actor: session.sub,
      outcome: "success",
    });
  }
  return applyCorsHeaders(NextResponse.json({ ok: true }), request);
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
