import { NextResponse } from "next/server";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById, getBookingByShortId } from "@/lib/bookings/data";
import { cancelJob } from "@/lib/bookings/lifecycle";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isValidShortId } from "@/lib/supabase/short-id";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CancelBody {
  reason?: unknown;
}

/**
 * PATCH /api/bookings/[id]/cancel
 *
 * Customer-initiated cancellation enforces the 1-hour-before-slot cutoff;
 * ops-initiated cancellation bypasses it (escape hatch for support).
 *
 * Sends `booking_cancelled` WhatsApp to the customer. The garage is NOT
 * notified here in V0 (they pick up the status change next time they open
 * the PWA); a follow-up template would be cheap to add later.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomerSession();
  const ops = await getOpsSession();
  if (!customer && !ops) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const booking = UUID_RE.test(id)
    ? await getBookingById(id)
    : isValidShortId(id)
      ? await getBookingByShortId(id)
      : null;
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (customer && !ops && booking.profileId !== customer.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as CancelBody;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  const actor = ops ? (ops.email ?? ops.sub) : customer!.sub;
  try {
    const updated = await cancelJob({
      bookingId: booking.id,
      reason,
      enforceCutoff: !ops, // ops can force-cancel
    });

    // Notify the customer (if a customer or ops did it, they still get the WA
    // for confirmation).
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("id", booking.profileId)
      .maybeSingle();
    let notificationOutcome: "sent" | "skipped" | "failed" = "skipped";
    if (profile?.phone) {
      const res = await notifyTemplate({
        to: profile.phone,
        template: "booking_cancelled",
        variables: [profile.first_name ?? "there", updated.shortId],
        bookingId: booking.id,
      });
      notificationOutcome = res.error ? "failed" : "sent";
    }

    await appendAuditEntry({
      action: "cancel_booking",
      entityType: "booking",
      entityId: booking.id,
      actor,
      payload: { reason, enforcedCutoff: !ops, notificationOutcome },
      before: { status: booking.status },
      outcome: "success",
    });
    return NextResponse.json({ booking: updated, notificationOutcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "cancel_booking",
      entityType: "booking",
      entityId: booking.id,
      actor,
      payload: { reason, enforcedCutoff: !ops },
      outcome: "error",
      error: message,
    });
    const status = message.startsWith("cutoff_exceeded")
      ? 409
      : message.includes("cannot cancel")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
