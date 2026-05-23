import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import {
  createBooking,
  listBookingsForProfile,
  resolveGarageId,
} from "@/lib/bookings/data";
import type {
  BookingBucket,
  CreateBookingInput,
  PaymentMode,
} from "@/lib/bookings/types";
import { appendAuditEntry } from "@/lib/audit/log";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import { rateLimit } from "@/lib/rate-limit/store";

export const runtime = "nodejs";

const VALID_BUCKETS: BookingBucket[] = ["detailing", "repairs", "denting"];
const VALID_PAYMENT_MODES: PaymentMode[] = ["upi", "cash"];

// Per-profile booking cap — deters spam and accidental double-submits.
// 5 in an hour is comfortably more than any sane real user.
const BOOKINGS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface CreateBody {
  bucket?: string;
  serviceIds?: unknown;
  garageId?: string | null;
  slotLabel?: string;
  slotDate?: string | null;
  slotTime?: string | null;
  paymentMode?: string;
  symptoms?: Record<string, unknown> | null;
  denting?: Record<string, unknown> | null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;

  if (!body.bucket || !VALID_BUCKETS.includes(body.bucket as BookingBucket)) {
    return NextResponse.json({ error: "invalid_bucket" }, { status: 400 });
  }
  if (!isStringArray(body.serviceIds)) {
    return NextResponse.json({ error: "invalid_service_ids" }, { status: 400 });
  }
  if (!body.slotLabel || typeof body.slotLabel !== "string") {
    return NextResponse.json({ error: "invalid_slot_label" }, { status: 400 });
  }
  if (
    !body.paymentMode ||
    !VALID_PAYMENT_MODES.includes(body.paymentMode as PaymentMode)
  ) {
    return NextResponse.json({ error: "invalid_payment_mode" }, { status: 400 });
  }

  // Per-profile rate limit. Above the cap returns 429 + Retry-After hint.
  const rl = await rateLimit(`booking:create:${session.sub}`, {
    max: BOOKINGS_PER_HOUR,
    windowMs: ONE_HOUR_MS,
  });
  if (!rl.ok) {
    await appendAuditEntry({
      action: "create_booking",
      entityType: "booking",
      entityId: "rate_limited",
      actor: session.sub,
      outcome: "error",
      error: "rate_limited",
    });
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  // Customer UI passes either a UUID or a legacy slug like "g-imran-k".
  // Resolve to a canonical UUID, or null if unknown — ops can still assign later.
  const resolvedGarageId = body.garageId
    ? await resolveGarageId(body.garageId).catch(() => null)
    : null;

  const input: CreateBookingInput = {
    profileId: session.sub,
    bucket: body.bucket as BookingBucket,
    serviceIds: body.serviceIds,
    garageId: resolvedGarageId,
    slotLabel: body.slotLabel,
    slotDate: body.slotDate ?? null,
    slotTime: body.slotTime ?? null,
    paymentMode: body.paymentMode as PaymentMode,
    symptoms: body.symptoms ?? null,
    denting: body.denting ?? null,
  };

  let booking;
  try {
    booking = await createBooking(input);
  } catch (err) {
    await appendAuditEntry({
      action: "create_booking",
      entityType: "booking",
      entityId: "new",
      actor: session.sub,
      payload: input,
      outcome: "error",
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  await appendAuditEntry({
    action: "create_booking",
    entityType: "booking",
    entityId: booking.id,
    actor: session.sub,
    payload: {
      shortId: booking.shortId,
      bucket: booking.bucket,
      serviceIds: booking.serviceIds,
      baseTotal: booking.baseTotal,
    },
    outcome: "success",
  });

  // Fire-and-log WhatsApp notification — never fail the booking on send error.
  if (session.phone) {
    try {
      await sendWhatsAppTemplate({
        to: session.phone,
        template: "booking_confirmed",
        variables: [
          booking.shortId,
          booking.slotLabel,
          String(booking.total ?? booking.baseTotal ?? 0),
        ],
      });
    } catch (err) {
      await appendAuditEntry({
        action: "booking_confirmed_send_failed",
        entityType: "booking",
        entityId: booking.id,
        actor: "system",
        outcome: "error",
        error: (err as Error).message,
      });
    }
  }

  return NextResponse.json({ booking }, { status: 201 });
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const bookings = await listBookingsForProfile(session.sub);
  return NextResponse.json({ bookings });
}
