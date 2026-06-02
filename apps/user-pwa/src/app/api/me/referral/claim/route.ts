import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { claimReferral } from "@/lib/referrals/data";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface ClaimBody {
  code?: unknown;
}

/**
 * POST /api/me/referral/claim
 *
 * Body: { code: string }
 *
 * Attach a referrer to the current profile. Called either on signup (when
 * `?ref=...` is present in the URL) or manually from the referrals page.
 * Idempotent — silently no-ops if already referred or self-referring.
 */
export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  try {
    const result = await claimReferral({ profileId: session.sub, code });
    await appendAuditEntry({
      action: "claim_referral",
      entityType: "profile",
      entityId: session.sub,
      actor: session.sub,
      payload: { code, claimed: result.claimed, reason: result.reason },
      outcome: result.claimed ? "success" : "error",
      error: result.claimed ? undefined : result.reason,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
