import { NextResponse } from "next/server";
import { acceptOpsInvite } from "@/lib/ops/users";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface AcceptBody {
  token?: unknown;
}

/**
 * POST /api/ops/invites/accept
 *
 * Body: { token: string }
 *
 * Public — no session required. Single-use; on success the seat is
 * activated. The recipient can then log in via /ops/login with their
 * email + the shared password.
 */
export async function POST(request: Request) {
  let body: AcceptBody;
  try {
    body = (await request.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  try {
    const user = await acceptOpsInvite(token);
    await appendAuditEntry({
      action: "accept_ops_invite",
      entityType: "ops_user",
      entityId: user.id,
      actor: user.email,
      outcome: "success",
    });
    return NextResponse.json({ email: user.email, role: user.role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "accept_ops_invite",
      entityType: "ops_user",
      entityId: token.slice(0, 6),
      actor: "anonymous",
      outcome: "error",
      error: message,
    });
    const status = message === "invite_not_found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
