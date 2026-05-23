import { NextResponse } from "next/server";
import { normalizeIndianPhone } from "@/lib/whatsapp/phone";
import { verifyOtp } from "@/lib/otp/store";
import { appendAuditEntry } from "@/lib/audit/log";
import { findGarageByPhone } from "@/lib/garage/data";
import { setSessionCookie } from "@/lib/auth/session";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

interface VerifyBody {
  phone?: string;
  code?: string;
}

/**
 * POST /api/garage/auth/otp/verify
 *
 * Differs from the customer verify:
 *   - The phone MUST resolve to an onboarded garage. If not, we still
 *     evaluate the OTP (so timing doesn't leak garage existence) but
 *     return a generic error response.
 *   - Sets `mw_garage_session` cookie with `sub = garage.id`.
 *   - Cookie is scoped to `.autogtg.com` so garage.autogtg.com and
 *     autogtg.com share the session (cross-subdomain).
 */
export async function POST(request: Request) {
  const actor = request.headers.get("x-actor") ?? "anonymous";
  const body = (await request.json().catch(() => ({}))) as VerifyBody;
  const phone = body.phone ? normalizeIndianPhone(body.phone) : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!phone || !/^\d{6}$/.test(code)) {
    await appendAuditEntry({
      action: "garage_verify_otp",
      entityType: "garage_auth",
      entityId: body.phone ?? "unknown",
      actor,
      outcome: "error",
      error: "invalid_input",
    });
    return applyCorsHeaders(
      NextResponse.json({ error: "invalid_input" }, { status: 400 }),
      request,
    );
  }

  const result = await verifyOtp({ phone, code });
  if (!result.ok) {
    await appendAuditEntry({
      action: "garage_verify_otp",
      entityType: "garage_auth",
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
    return applyCorsHeaders(
      NextResponse.json(
        { error: result.reason, attemptsRemaining: result.attemptsRemaining },
        { status: statusMap[result.reason] },
      ),
      request,
    );
  }

  // OTP correct — now look up the garage. If somehow no garage matches
  // (shouldn't happen after the send route gate, but defensive), fail closed.
  const garage = await findGarageByPhone(phone);
  if (!garage) {
    await appendAuditEntry({
      action: "garage_verify_otp",
      entityType: "garage_auth",
      entityId: phone,
      actor,
      outcome: "error",
      error: "phone_not_registered",
    });
    return applyCorsHeaders(
      NextResponse.json({ error: "phone_not_registered" }, { status: 404 }),
      request,
    );
  }

  try {
    await setSessionCookie({
      role: "garage",
      sub: garage.id,
      phone,
      crossSubdomain: true,
    });
  } catch (err) {
    await appendAuditEntry({
      action: "garage_verify_otp",
      entityType: "garage_auth",
      entityId: garage.id,
      actor,
      outcome: "error",
      error: `session_failed: ${(err as Error).message}`,
    });
    return applyCorsHeaders(
      NextResponse.json({ error: "session_failed" }, { status: 500 }),
      request,
    );
  }

  await appendAuditEntry({
    action: "garage_verify_otp",
    entityType: "garage_auth",
    entityId: garage.id,
    actor,
    outcome: "success",
  });
  await appendAuditEntry({
    action: "garage_signin",
    entityType: "garage",
    entityId: garage.id,
    actor: garage.id,
    outcome: "success",
  });

  return applyCorsHeaders(
    NextResponse.json({
      verified: true,
      garage: {
        id: garage.id,
        shopName: garage.shopName,
        ownerFirstName: garage.ownerFirstName,
        area: garage.area,
      },
    }),
    request,
  );
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
