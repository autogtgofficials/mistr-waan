import { NextResponse } from "next/server";
import { clearSessionCookie, getCustomerSession } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

/**
 * POST /api/auth/signout
 * Clears the customer session cookie. Idempotent — always returns 200.
 */
export async function POST() {
  const session = await getCustomerSession();
  if (session) {
    await appendAuditEntry({
      action: "signout",
      entityType: "profile",
      entityId: session.sub,
      actor: session.sub,
      outcome: "success",
    });
  }
  await clearSessionCookie("customer");
  return NextResponse.json({ signedOut: true });
}
