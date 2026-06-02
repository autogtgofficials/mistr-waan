import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { setPhotoRequest } from "@/lib/whatsapp/bot/photo-requests";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

/**
 * POST /api/ops/bookings/[id]/request-photos
 *
 * Ops triggers a WhatsApp prompt asking the customer to send photos for this
 * booking. Saves a PhotoRequest entry keyed by the customer's phone. The
 * webhook router picks up the next 24h of inbound image messages from that
 * phone, downloads each via Meta's media API, and uploads to Storage with
 * the booking_id linked.
 *
 * Returns: { sent: true, expiresAt: ms_epoch }
 */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const booking = await getBookingById(id);
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Look up customer phone for the WA prompt.
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, first_name")
    .eq("id", booking.profileId)
    .maybeSingle();
  if (!profile?.phone) {
    return NextResponse.json({ error: "no_customer_phone" }, { status: 400 });
  }

  const actor = session.email ?? session.sub;
  try {
    await setPhotoRequest({
      phone: profile.phone,
      bookingId: booking.id,
      bookingShortId: booking.shortId,
    });
    const res = await notifyTemplate({
      to: profile.phone,
      template: "request_photos",
      variables: [profile.first_name ?? "there", booking.shortId],
      bookingId: booking.id,
    });
    await appendAuditEntry({
      action: "request_photos",
      entityType: "booking",
      entityId: booking.id,
      actor,
      payload: { customerPhone: profile.phone, notificationOutcome: res.error ? "failed" : "sent" },
      outcome: "success",
    });
    return NextResponse.json({
      sent: true,
      notificationOutcome: res.error ? "failed" : "sent",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "request_photos",
      entityType: "booking",
      entityId: booking.id,
      actor,
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
