import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { setSessionCookie } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";
import {
  ensureBootstrapAdmin,
  findOpsUserByEmail,
  touchOpsLogin,
} from "@/lib/ops/users";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
}

/**
 * POST /api/ops/login
 *
 * Login validates: email matches an active `ops_users` seat AND the shared
 * password matches OPS_SHARED_PASSWORD. On success the session cookie is
 * scoped to the seat's id (so audit + invites attribute correctly).
 *
 * Bootstrap: if no ops_users rows exist yet, the first login auto-creates
 * an admin seat for the provided email. After that, every email must be
 * invited first via /api/ops/invites.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const supplied = typeof body.password === "string" ? body.password : "";
  const expected = process.env.OPS_SHARED_PASSWORD ?? "";

  if (!expected) {
    return NextResponse.json({ error: "ops_password_not_configured" }, { status: 500 });
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Constant-time compare; equal lengths required.
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  const passwordOk = a.length === b.length && timingSafeEqual(a, b);

  if (!passwordOk) {
    await appendAuditEntry({
      action: "ops_login",
      entityType: "ops_session",
      entityId: email,
      actor: email,
      outcome: "error",
      error: "bad_password",
    });
    return NextResponse.json({ error: "bad_password" }, { status: 401 });
  }

  let user = await findOpsUserByEmail(email);
  if (!user) {
    // Bootstrap: zero seats yet → auto-create admin for this email.
    try {
      user = await ensureBootstrapAdmin(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      await appendAuditEntry({
        action: "ops_login",
        entityType: "ops_session",
        entityId: email,
        actor: email,
        outcome: "error",
        error: message,
      });
      // `invite_required` means rows already exist but this email isn't on
      // the list. Surface as 403 with a clear code.
      const status = message === "invite_required" ? 403 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  } else if (!user.active) {
    await appendAuditEntry({
      action: "ops_login",
      entityType: "ops_session",
      entityId: user.id,
      actor: email,
      outcome: "error",
      error: "invite_pending",
    });
    return NextResponse.json({ error: "invite_pending" }, { status: 403 });
  }

  await setSessionCookie({
    role: "ops",
    sub: user.id,
    email: user.email,
  });
  await touchOpsLogin(user.id);

  await appendAuditEntry({
    action: "ops_login",
    entityType: "ops_session",
    entityId: user.id,
    actor: user.email,
    outcome: "success",
  });

  return NextResponse.json({ loggedIn: true, email: user.email, role: user.role });
}
