import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import {
  createOrder,
  isRazorpayEnabled,
  publicKeyId,
} from "@/lib/payments/razorpay";
import { createPendingPayment, getLatestPaymentForBooking } from "@/lib/payments/data";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface CreateOrderBody {
  bookingId?: unknown;
}

/**
 * POST /api/payments/create-order
 *
 * Body: { bookingId: string }
 *
 * Returns: { orderId, keyId, amountPaise, currency }
 *
 * Customer creates a Razorpay order for a booking they own. The booking
 * must be in `quoted` status with `paymentMode='upi'` and a positive total.
 * On success we insert a pending `payments` row and return the order
 * envelope the Razorpay Checkout script needs.
 */
export async function POST(request: Request) {
  if (!isRazorpayEnabled()) {
    return NextResponse.json({ error: "razorpay_disabled" }, { status: 503 });
  }

  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateOrderBody;
  try {
    body = (await request.json()) as CreateOrderBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  if (!bookingId) {
    return NextResponse.json({ error: "booking_id_required" }, { status: 400 });
  }

  const booking = await getBookingById(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (booking.profileId !== session.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (booking.paymentMode !== "upi") {
    return NextResponse.json(
      { error: "payment_mode_mismatch", detail: "this booking is paid in cash" },
      { status: 400 },
    );
  }
  if (booking.total == null || booking.total <= 0) {
    return NextResponse.json({ error: "no_quote" }, { status: 400 });
  }

  // Idempotency-ish: if a captured payment already exists, refuse to create a new order.
  const existing = await getLatestPaymentForBooking(booking.id);
  if (existing && existing.status === "captured") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  try {
    const order = await createOrder({
      amountRupees: booking.total,
      receipt: booking.shortId,
      notes: {
        booking_id: booking.id,
        short_id: booking.shortId,
        profile_id: booking.profileId,
      },
    });
    await createPendingPayment({
      bookingId: booking.id,
      amount: booking.total,
      razorpayOrderId: order.id,
    });

    await appendAuditEntry({
      action: "create_payment_order",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      payload: { razorpayOrderId: order.id, amount: booking.total },
      outcome: "success",
    });

    return NextResponse.json({
      orderId: order.id,
      keyId: publicKeyId(),
      amountPaise: order.amount,
      currency: order.currency,
      shortId: booking.shortId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "create_payment_order",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: "create_failed", detail: message }, { status: 502 });
  }
}
