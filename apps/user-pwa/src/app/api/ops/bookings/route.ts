import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsBookings } from "@/lib/bookings/ops-data";
import { createBooking } from "@/lib/bookings/data";
import { upsertProfileByPhone } from "@/lib/auth/profile";
import { normalizeIndianPhone } from "@/lib/whatsapp/phone";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEntry } from "@/lib/audit/log";
import type {
  BookingBucket,
  BookingStatus,
  PaymentMode,
  VehicleType,
} from "@/lib/bookings/types";

export const runtime = "nodejs";

const VALID_STATUSES: BookingStatus[] = [
  "queued_for_call",
  "quoted",
  "awaiting_garage",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
  "declined_by_garage",
];
const VALID_BUCKETS: BookingBucket[] = [
  "detailing",
  "repairs",
  "denting",
  "scheduled_maintenance",
  "rsa",
];
const VALID_PAYMENT_MODES: PaymentMode[] = ["upi", "cash"];
const VALID_VEHICLE_TYPES: VehicleType[] = ["car", "bike"];

export async function GET(request: Request) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const bucketRaw = url.searchParams.get("bucket");
  const limitRaw = url.searchParams.get("limit");

  const status =
    statusRaw && (statusRaw === "all" || VALID_STATUSES.includes(statusRaw as BookingStatus))
      ? (statusRaw as BookingStatus | "all")
      : undefined;
  const bucket =
    bucketRaw && (bucketRaw === "all" || VALID_BUCKETS.includes(bucketRaw as BookingBucket))
      ? (bucketRaw as BookingBucket | "all")
      : undefined;
  const limit = limitRaw ? Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 100)) : 100;

  const bookings = await listOpsBookings({ status, bucket, limit });
  return NextResponse.json({ bookings });
}

interface CreateBody {
  phone?: unknown;
  firstName?: unknown;
  bucket?: unknown;
  serviceIds?: unknown;
  garageId?: unknown;
  slotLabel?: unknown;
  paymentMode?: unknown;
  vehicleType?: unknown;
  vehicleBrand?: unknown;
  vehicleModel?: unknown;
  vehicleRegistration?: unknown;
}

/**
 * POST /api/ops/bookings
 *
 * Ops creates a booking on a customer's behalf — the call-first flow. When a
 * customer calls in (via the "Call to confirm" button) ops captures their
 * phone + service here. We upsert a profile by phone (so the customer can
 * later log in with that number to track + pay) and create the booking in
 * `queued_for_call`. Ops can then quote/assign from the booking detail page.
 */
export async function POST(request: Request) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? normalizeIndianPhone(body.phone) : null;
  if (!phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (!VALID_BUCKETS.includes(body.bucket as BookingBucket)) {
    return NextResponse.json({ error: "invalid_bucket" }, { status: 400 });
  }
  if (!VALID_PAYMENT_MODES.includes(body.paymentMode as PaymentMode)) {
    return NextResponse.json({ error: "invalid_payment_mode" }, { status: 400 });
  }
  const serviceIds = Array.isArray(body.serviceIds)
    ? body.serviceIds.filter((x): x is string => typeof x === "string")
    : [];
  const slotLabel =
    typeof body.slotLabel === "string" && body.slotLabel.trim()
      ? body.slotLabel.trim()
      : "To be confirmed";
  const vehicleType = VALID_VEHICLE_TYPES.includes(body.vehicleType as VehicleType)
    ? (body.vehicleType as VehicleType)
    : null;
  const firstName =
    typeof body.firstName === "string" && body.firstName.trim()
      ? body.firstName.trim().slice(0, 80)
      : null;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const actor = session.email ?? session.sub;
  try {
    const profile = await upsertProfileByPhone(phone);
    if (firstName) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("profiles")
        .update({ first_name: firstName })
        .eq("id", profile.id)
        .is("first_name", null);
    }

    const booking = await createBooking({
      profileId: profile.id,
      bucket: body.bucket as BookingBucket,
      serviceIds,
      garageId: str(body.garageId),
      slotLabel,
      paymentMode: body.paymentMode as PaymentMode,
      vehicleType,
      vehicleBrand: str(body.vehicleBrand),
      vehicleModel: str(body.vehicleModel),
      vehicleRegistration: str(body.vehicleRegistration),
    });

    await appendAuditEntry({
      action: "ops_create_booking",
      entityType: "booking",
      entityId: booking.id,
      actor,
      payload: {
        phone,
        shortId: booking.shortId,
        bucket: booking.bucket,
        serviceIds: booking.serviceIds,
        garageId: booking.garageId,
        source: "ops_call",
      },
      outcome: "success",
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "ops_create_booking",
      entityType: "booking",
      entityId: "new",
      actor,
      payload: { phone, bucket: body.bucket },
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: "create_failed", detail: message }, { status: 500 });
  }
}
