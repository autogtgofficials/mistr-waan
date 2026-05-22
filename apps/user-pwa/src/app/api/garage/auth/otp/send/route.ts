import { NextResponse } from "next/server";
import { normalizeIndianPhone } from "@/lib/whatsapp/phone";
import { sendWhatsAppOtp } from "@/lib/whatsapp/client";
import { WhatsAppError } from "@/lib/whatsapp/types";
import { issueOtp } from "@/lib/otp/store";
import { appendAuditEntry } from "@/lib/audit/log";
import { findGarageByPhone } from "@/lib/garage/data";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

interface SendBody {
  phone?: string;
}

/**
 * POST /api/garage/auth/otp/send
 *
 * Garage-side counterpart of `/api/auth/otp/send`. Differences:
 *   - Phone must already exist in `garages.phone` or `garages.whatsapp_phone`.
 *     Garages don't self-register — ops onboards them.
 *   - We don't expose whether a phone exists or not (anti-enumeration):
 *     a "no garage with this phone" still returns 200 with a generic
 *     "if your number is registered, you'll get a code" message, but does
 *     NOT actually send the OTP. Audit row captures the real outcome.
 */
export async function POST(request: Request) {
  const actor = request.headers.get("x-actor") ?? "anonymous";
  const body = (await request.json().catch(() => ({}))) as SendBody;
  const phone = body.phone ? normalizeIndianPhone(body.phone) : null;

  if (!phone) {
    await appendAuditEntry({
      action: "garage_send_otp",
      entityType: "garage_auth",
      entityId: body.phone ?? "unknown",
      actor,
      outcome: "error",
      error: "invalid_phone",
    });
    return applyCorsHeaders(
      NextResponse.json({ error: "invalid_phone" }, { status: 400 }),
      request,
    );
  }

  // Look up the garage. We log the outcome but always reply with a generic
  // "ok" so an attacker can't enumerate which phones are onboarded.
  const garage = await findGarageByPhone(phone);
  if (!garage) {
    await appendAuditEntry({
      action: "garage_send_otp",
      entityType: "garage_auth",
      entityId: phone,
      actor,
      outcome: "error",
      error: "phone_not_registered",
    });
    // 200 + opaque body. Client will go to the OTP-entry screen and fail
    // verification there.
    return applyCorsHeaders(
      NextResponse.json({ sent: true, channel: "whatsapp" }),
      request,
    );
  }

  const issued = await issueOtp({ phone, channel: "whatsapp" });
  if (!issued.ok) {
    await appendAuditEntry({
      action: "garage_send_otp",
      entityType: "garage_auth",
      entityId: phone,
      actor,
      outcome: "error",
      error: `cooldown:${issued.retryAfterMs}`,
    });
    return applyCorsHeaders(
      NextResponse.json(
        { error: "cooldown", retryAfterMs: issued.retryAfterMs },
        { status: 429 },
      ),
      request,
    );
  }

  try {
    const send = await sendWhatsAppOtp({ to: phone, code: issued.result.code });
    await appendAuditEntry({
      action: "garage_send_otp",
      entityType: "garage_auth",
      entityId: garage.id,
      actor,
      payload: { provider: send.provider, messageId: send.messageId },
      outcome: "success",
    });
    return applyCorsHeaders(
      NextResponse.json({ sent: true, channel: "whatsapp", expiresAt: issued.result.expiresAt }),
      request,
    );
  } catch (err) {
    const isWaErr = err instanceof WhatsAppError;
    await appendAuditEntry({
      action: "garage_send_otp",
      entityType: "garage_auth",
      entityId: garage.id,
      actor,
      outcome: "error",
      error: isWaErr ? `${err.code}:${err.message}` : (err as Error).message,
    });
    return applyCorsHeaders(
      NextResponse.json({ error: "send_failed" }, { status: 502 }),
      request,
    );
  }
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
