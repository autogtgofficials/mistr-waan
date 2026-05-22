import { NextResponse } from "next/server";
import {
  isRazorpayEnabled,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";
import {
  findPaymentByOrderId,
  markPaymentCaptured,
  markPaymentFailed,
} from "@/lib/payments/data";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

/**
 * POST /api/payments/webhook
 *
 * Razorpay event webhook (configure in dashboard).
 * Required signature: `X-Razorpay-Signature` over the raw body.
 *
 * Events we react to:
 *   - payment.captured  → mark payments row captured (idempotent)
 *   - payment.failed    → mark failed
 *   - refund.processed  → log only (refund flow lives in Razorpay dashboard
 *                          until V1 — we just audit it for now)
 *
 * Must return 200 quickly; Razorpay retries non-2xx.
 */
export async function POST(request: Request) {
  if (!isRazorpayEnabled()) {
    return NextResponse.json({ error: "razorpay_disabled" }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature({ rawBody, signature })) {
    await appendAuditEntry({
      action: "razorpay_webhook_rejected",
      entityType: "payment_webhook",
      entityId: "unknown",
      actor: "razorpay",
      outcome: "error",
      error: "invalid_signature",
    });
    return new Response("invalid signature", { status: 401 });
  }

  let payload: {
    event?: string;
    payload?: { payment?: { entity?: PaymentEntity } };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const event = payload.event ?? "unknown";
  const entity = payload.payload?.payment?.entity;

  try {
    if (event === "payment.captured" && entity?.order_id && entity.id) {
      await markPaymentCaptured({
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        razorpaySignature: signature,
        rawPayload: payload,
      });
      await appendAuditEntry({
        action: "razorpay_webhook",
        entityType: "payment",
        entityId: entity.order_id,
        actor: "razorpay",
        payload: { event, paymentId: entity.id },
        outcome: "success",
      });
    } else if (event === "payment.failed" && entity?.order_id) {
      await markPaymentFailed({
        razorpayOrderId: entity.order_id,
        rawPayload: payload,
      });
      const existing = await findPaymentByOrderId(entity.order_id);
      await appendAuditEntry({
        action: "razorpay_webhook",
        entityType: "payment",
        entityId: entity.order_id,
        actor: "razorpay",
        payload: { event, bookingId: existing?.bookingId },
        outcome: "success",
      });
    } else {
      // refund.processed and any unhandled event types — log and accept.
      await appendAuditEntry({
        action: "razorpay_webhook",
        entityType: "payment_webhook",
        entityId: entity?.order_id ?? "unknown",
        actor: "razorpay",
        payload: { event },
        outcome: "success",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "razorpay_webhook",
      entityType: "payment_webhook",
      entityId: entity?.order_id ?? "unknown",
      actor: "razorpay",
      payload: { event },
      outcome: "error",
      error: message,
    });
    // Still return 200 — Razorpay would retry on failure, but we don't want
    // a transient DB blip to cause a retry storm. The audit trail captures
    // the error for ops to inspect.
  }

  return NextResponse.json({ ok: true });
}

interface PaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
}
