import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { assignGarage } from "@/lib/bookings/assign";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface AssignBody {
  garageId?: unknown;
}

/**
 * PATCH /api/ops/bookings/[id]/assign
 *
 * Body: { garageId: string }  // UUID or slug
 *
 * Ops session required. Moves booking to `awaiting_garage`, then notifies the
 * garage via the `garage_new_job` template with Accept / Decline quick-reply
 * buttons whose payloads are `booking:<short_id>:accept|decline`.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: AssignBody;
  try {
    body = (await request.json()) as AssignBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const garageIdOrSlug = typeof body.garageId === "string" ? body.garageId.trim() : "";
  if (!garageIdOrSlug) {
    return NextResponse.json(
      { error: "garage_id_required" },
      { status: 400 },
    );
  }

  const before = await getBookingById(id);
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const actor = session.email ?? session.sub;
  try {
    const updated = await assignGarage({
      bookingId: id,
      garageIdOrSlug,
    });

    // Look up garage's WhatsApp phone + customer name for the template.
    const supabase = getSupabaseAdmin();
    const [{ data: garage }, { data: profile }] = await Promise.all([
      supabase
        .from("garages")
        .select("phone, whatsapp_phone, shop_name, owner_first_name")
        .eq("id", updated.garageId!)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, phone")
        .eq("id", updated.profileId)
        .maybeSingle(),
    ]);

    let notificationOutcome: "sent" | "skipped" | "failed" = "skipped";
    const garagePhone = garage?.whatsapp_phone ?? garage?.phone ?? null;
    if (garagePhone) {
      const customerLabel =
        profile?.first_name ?? (profile?.phone ? `customer ${profile.phone.slice(-4)}` : "customer");
      const firstService = updated.services?.[0]?.name ?? updated.bucket;
      const res = await notifyTemplate({
        to: garagePhone,
        template: "garage_new_job",
        variables: [
          garage?.owner_first_name ?? garage?.shop_name ?? "team",
          customerLabel,
          firstService,
          updated.slotLabel,
        ],
        buttonPayloads: [
          { index: 0, payload: `booking:${updated.shortId}:accept` },
          { index: 1, payload: `booking:${updated.shortId}:decline` },
        ],
        bookingId: id,
      });
      notificationOutcome = res.error ? "failed" : "sent";
    }

    await appendAuditEntry({
      action: "assign_garage",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { garageId: updated.garageId, notificationOutcome },
      before: { status: before.status, garageId: before.garageId },
      outcome: "success",
    });

    return NextResponse.json({ booking: updated, notificationOutcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "assign_garage",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { garageIdOrSlug },
      outcome: "error",
      error: message,
    });
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
