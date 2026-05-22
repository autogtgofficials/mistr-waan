import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { setSessionCookie } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface LoginBody {
  password?: string;
}

/**
 * POST /api/ops/login
 *
 * Shared-password login for the ops dashboard (week 1 only).
 * Compares against OPS_SHARED_PASSWORD via constant-time comparison and,
 * on success, sets the `mw_ops_session` cookie with role=ops.
 *
 * Future: invite-only seats with per-user credentials live in the
 * `ops_users` table; we'll add `/api/ops/invites/accept` then deprecate this.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const supplied = typeof body.password === "string" ? body.password : "";
  const expected = process.env.OPS_SHARED_PASSWORD ?? "";

  if (!expected) {
    return NextResponse.json({ error: "ops_password_not_configured" }, { status: 500 });
  }

  // Constant-time compare; pad to equal length first to avoid the throw.
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    await appendAuditEntry({
      action: "ops_login",
      entityType: "ops_session",
      entityId: "shared",
      actor: "anonymous",
      outcome: "error",
      error: "bad_password",
    });
    return NextResponse.json({ error: "bad_password" }, { status: 401 });
  }

  // Issue an ops session. `sub` is a stable identifier for the shared seat —
  // when we move to per-user seats this becomes ops_users.id.
  await setSessionCookie({
    role: "ops",
    sub: "shared-ops",
    email: "ops@autogtg.com",
  });

  await appendAuditEntry({
    action: "ops_login",
    entityType: "ops_session",
    entityId: "shared",
    actor: "shared-ops",
    outcome: "success",
  });

  return NextResponse.json({ loggedIn: true });
}
