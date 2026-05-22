import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import {
  createOpsInvite,
  findOpsUserByEmail,
  listOpsUsers,
} from "@/lib/ops/users";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface InviteBody {
  email?: unknown;
  role?: unknown;
}

/** GET /api/ops/invites — list all ops seats (active + pending). */
export async function GET() {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const users = await listOpsUsers();
  // Don't leak the invite tokens by default.
  const safe = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    active: u.active,
    inviteAcceptedAt: u.inviteAcceptedAt,
    invitedBy: u.invitedBy,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }));
  return NextResponse.json({ users: safe });
}

/**
 * POST /api/ops/invites
 *
 * Body: { email: string, role?: "ops" | "admin" }
 *
 * Returns: { invite: { email, role, acceptUrl } }
 *
 * The single-use token is embedded in `acceptUrl` so the inviter can copy
 * it into a message. Email send isn't wired yet.
 */
export async function POST(request: Request) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "admin" ? "admin" : "ops";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    const invitedByEntry = await findOpsUserByEmail(session.email ?? "");
    const invite = await createOpsInvite({
      email,
      role,
      invitedByOpsUserId: invitedByEntry?.id ?? null,
    });
    await appendAuditEntry({
      action: "invite_ops_user",
      entityType: "ops_user",
      entityId: invite.id,
      actor: session.email ?? session.sub,
      payload: { email, role, active: invite.active },
      outcome: "success",
    });
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://autogtg.com";
    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        active: invite.active,
        acceptUrl: invite.inviteToken
          ? `${origin}/ops/invite/accept?token=${encodeURIComponent(invite.inviteToken)}`
          : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "invite_ops_user",
      entityType: "ops_user",
      entityId: email,
      actor: session.email ?? session.sub,
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
