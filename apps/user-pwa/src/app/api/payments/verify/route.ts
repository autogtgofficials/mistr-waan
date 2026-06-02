import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import {
  isRazorpayEnabled,
  verifyCheckoutSignature,
} from "@/lib/payments/razorpay";
import {
  findPaymentByOrderId,
  markPaymentCaptured,
} from "@/lib/payments/data";
import { getBookingById } from "@/lib/bookings/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface VerifyBody {
  razorpayOrderId?: unknown;
  razorpayPaymentId?: unknown;
  razorpaySignature?: unknown;
}

/**
 * POST /api/payments/verify
 *
 * The success handler in Razorpay Checkout calls this with the three
 * identifiers Razorpay returns. We HMAC-verify the signature; on success we
 * mark the payment captured and (if appropriate) advance the booking from
 * `quoted` → `awaiting_garage` so ops can pick it up for assignment.
 */
export async function POST(request: Request) {
  if (!isRazorpayEnabled()) {
    return NextResponse.json({ error: "razorpay_disabled" }, { status: 503 });
  }

  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const orderId = typeof body.razorpayOrderId === "string" ? body.razorpayOrderId : "";
  const paymentId = typeof body.razorpayPaymentId === "string" ? body.razorpayPaymentId : "";
  const signature = typeof body.razorpaySignature === "string" ? body.razorpaySignature : "";
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Look up the pending payment to bind to the booking; also verifies the
  // order id is one we created (so an attacker can't replay an arbitrary
  // signature against a different booking).
  const pending = await findPaymentByOrderId(orderId);
  if (!pending) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  const booking = await getBookingById(pending.bookingId);
  if (!booking || booking.profileId !== session.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    await appendAuditEntry({
      action: "verify_payment",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      payload: { razorpayOrderId: orderId },
      outcome: "error",
      error: "invalid_signature",
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    await markPaymentCaptured({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });

    // Advance the booking if it's still in `quoted` and has no garage yet.
    // If ops already assigned a garage manually (cash-style), don't downgrade.
    let advanced = false;
    if (booking.status === "quoted" && !booking.garageId) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("bookings")
        .update({ status: "awaiting_garage" })
        .eq("id", booking.id);
      if (!error) advanced = true;
    }

    await appendAuditEntry({
      action: "verify_payment",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      payload: {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        advancedToAwaitingGarage: advanced,
      },
      outcome: "success",
    });

    return NextResponse.json({ captured: true, advancedToAwaitingGarage: advanced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "verify_payment",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      payload: { razorpayOrderId: orderId },
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: "capture_failed", detail: message }, { status: 500 });
  }
}
