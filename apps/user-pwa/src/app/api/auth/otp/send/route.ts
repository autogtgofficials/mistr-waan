import { NextResponse } from "next/server";
import { normalizeIndianPhone } from "@/lib/whatsapp/phone";
import { sendWhatsAppOtp } from "@/lib/whatsapp/client";
import { WhatsAppError } from "@/lib/whatsapp/types";
import { issueOtp } from "@/lib/otp/store";
import { testOtpCodeFor } from "@/lib/otp/test-numbers";
import { appendAuditEntry } from "@/lib/audit/log";
import { rateLimit } from "@/lib/rate-limit/store";

// Daily OTP cap per phone — on top of the existing 60s cooldown inside
// issueOtp. 10/day is plenty for a real user; an attacker burning through
// codes hits the wall fast.
const OTP_PER_DAY = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const runtime = "nodejs";

interface SendBody {
  phone?: string;
  channel?: "whatsapp" | "sms";
}

export async function POST(request: Request) {
  const actor = request.headers.get("x-actor") ?? "anonymous";
  const body = (await request.json().catch(() => ({}))) as SendBody;
  const channel = body.channel ?? "whatsapp";

  const phone = body.phone ? normalizeIndianPhone(body.phone) : null;
  if (!phone) {
    await appendAuditEntry({
      action: "send_otp",
      entityType: "auth",
      entityId: body.phone ?? "unknown",
      actor,
      payload: { channel, phoneInput: body.phone },
      outcome: "error",
      error: "invalid_phone",
    });
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  if (channel !== "whatsapp") {
    // SMS provider is not wired yet — fail loud rather than silently dropping.
    return NextResponse.json(
      { error: "channel_not_supported", channel },
      { status: 501 },
    );
  }

  // Per-phone daily cap (defence-in-depth on top of issueOtp's 60s cooldown).
  const rl = await rateLimit(`otp:send:${phone}`, {
    max: OTP_PER_DAY,
    windowMs: ONE_DAY_MS,
  });
  if (!rl.ok) {
    await appendAuditEntry({
      action: "send_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      payload: { channel, dailyCapHit: true },
      outcome: "error",
      error: "rate_limited",
    });
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  // Test-number bypass: a fixed code + no WhatsApp send (set via OTP_TEST_NUMBERS).
  const testCode = testOtpCodeFor(phone);

  const issued = await issueOtp({
    phone,
    channel,
    fixedCode: testCode ?? undefined,
  });
  if (!issued.ok) {
    await appendAuditEntry({
      action: "send_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      payload: { channel },
      outcome: "error",
      error: `cooldown:${issued.retryAfterMs}`,
    });
    return NextResponse.json(
      { error: "cooldown", retryAfterMs: issued.retryAfterMs },
      { status: 429 },
    );
  }

  if (testCode) {
    await appendAuditEntry({
      action: "send_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      payload: { channel, test: true },
      outcome: "success",
    });
    return NextResponse.json({
      sent: true,
      channel,
      expiresAt: issued.result.expiresAt,
    });
  }

  try {
    const send = await sendWhatsAppOtp({ to: phone, code: issued.result.code });
    await appendAuditEntry({
      action: "send_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      payload: { channel, provider: send.provider, messageId: send.messageId },
      outcome: "success",
    });
    return NextResponse.json({
      sent: true,
      channel,
      expiresAt: issued.result.expiresAt,
    });
  } catch (err) {
    const isWaErr = err instanceof WhatsAppError;
    await appendAuditEntry({
      action: "send_otp",
      entityType: "auth",
      entityId: phone,
      actor,
      payload: { channel },
      outcome: "error",
      error: isWaErr ? `${err.code}:${err.message}` : (err as Error).message,
    });
    const status = isWaErr ? err.status : 502;
    return NextResponse.json(
      { error: "send_failed", detail: isWaErr ? err.code : "unknown" },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
