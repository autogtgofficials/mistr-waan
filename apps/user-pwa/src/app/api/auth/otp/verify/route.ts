import { NextResponse } from "next/server";
import { normalizeIndianPhone } from "@/lib/whatsapp/phone";
import { verifyOtp } from "@/lib/otp/store";
import { appendAuditEntry } from "@/lib/audit/log";

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

  await appendAuditEntry({
    action: "verify_otp",
    entityType: "auth",
    entityId: phone,
    actor,
    outcome: "success",
  });
  return NextResponse.json({ verified: true, phone });
}
