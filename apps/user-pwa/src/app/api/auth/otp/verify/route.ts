import { NextResponse } from "next/server";
import { normalizeIndianPhone } from "@/lib/whatsapp/phone";
import { verifyOtp } from "@/lib/otp/store";
import { appendAuditEntry } from "@/lib/audit/log";
import { upsertProfileByPhone } from "@/lib/auth/profile";
import { setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

interface VerifyBody {
  phone?: string;
  code?: string;
}

export async function POST(request: Request) {
  const actor = request.headers.get("x-actor") ?? "anonymous";
  const body = (await request.json().catch(() => ({}))) as VerifyBody;

  const phone = body.phone ? normalizeIndianPhone(body.phone) : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone || !/^\d{6}$/.test(code)) {
    await appendAuditEntry({
      action: "verify_otp",
      entityType: "auth",
      entityId: body.phone ?? "unknown",
      actor,
      outcome: "error",
      error: "invalid_input",
    });
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await verifyOtp({ phone, code });
  if (!result.ok) {
    await appendAuditEntry({
      action: "verify_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      outcome: "error",
      error: result.reason,
    });
    const statusMap = {
      not_found: 404,
      expired: 410,
      too_many_attempts: 429,
      wrong_code: 401,
    } as const;
    return NextResponse.json(
      { error: result.reason, attemptsRemaining: result.attemptsRemaining },
      { status: statusMap[result.reason] },
    );
  }

  // OTP verified — upsert profile and issue JWT session cookie.
  let profileId: string;
  try {
    const profile = await upsertProfileByPhone(phone);
    profileId = profile.id;
    await setSessionCookie({ role: "customer", sub: profile.id, phone });
  } catch (err) {
    await appendAuditEntry({
      action: "verify_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      outcome: "error",
      error: `profile_or_session_failed: ${(err as Error).message}`,
    });
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }

  await appendAuditEntry({
    action: "verify_otp",
    entityType: "auth",
    entityId: phone,
    actor,
    outcome: "success",
  });
  await appendAuditEntry({
    action: "signin",
    entityType: "profile",
    entityId: profileId,
    actor: profileId,
    outcome: "success",
  });
  return NextResponse.json({ verified: true, phone, profileId });
}
