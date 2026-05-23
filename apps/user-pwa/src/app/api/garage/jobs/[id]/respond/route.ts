import { NextResponse } from "next/server";
import { getGarageSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { respondToAssignment } from "@/lib/bookings/assign";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

interface RespondBody {
  outcome?: unknown;
}

/**
 * POST /api/garage/jobs/[id]/respond
 *
 * Body: { outcome: "accept" | "decline" }
 *
 * Authenticated as the garage. Verifies the booking is actually assigned to
 * this garage, transitions the status, and notifies the customer.
 *
 * Same internal transition as the WhatsApp Accept/Decline button flow.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getGarageSession();
  if (!session) {
    return applyCorsHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      request,
    );
  }
  const { id } = await ctx.params;

  let body: RespondBody;
  try {
    body = (await request.json()) as RespondBody;
  } catch {
    return applyCorsHeaders(
      NextResponse.json({ error: "invalid_json" }, { status: 400 }),
      request,
    );
  }
  const outcome = body.outcome === "accept" || body.outcome === "decline" ? body.outcome : null;
  if (!outcome) {
    return applyCorsHeaders(
      NextResponse.json({ error: "invalid_outcome" }, { status: 400 }),
      request,
    );
  }

  const before = await getBookingById(id);
  if (!before) {
    return applyCorsHeaders(
      NextResponse.json({ error: "not_found" }, { status: 404 }),
      request,
    );
  }
  if (before.garageId !== session.sub) {
    return applyCorsHeaders(
      NextResponse.json({ error: "forbidden" }, { status: 403 }),
      request,
    );
  }

  try {
    const updated = await respondToAssignment({
      bookingId: id,
      garageId: session.sub,
      outcome,
    });

    // Notify the customer.
    const supabase = getSupabaseAdmin();
    const [{ data: profile }, { data: garage }] = await Promise.all([
      supabase
        .from("profiles")
        .select("phone, first_name")
        .eq("id", before.profileId)
        .maybeSingle(),
      supabase
        .from("garages")
        .select("shop_name")
        .eq("id", session.sub)
        .maybeSingle(),
    ]);
    let notificationOutcome: "sent" | "skipped" | "failed" = "skipped";
    if (profile?.phone) {
      const res =
        outcome === "accept"
          ? await notifyTemplate({
              to: profile.phone,
              template: "mechanic_assigned",
              variables: [garage?.shop_name ?? "your assigned garage", updated.shortId],
              bookingId: id,
            })
          : await notifyTemplate({
              to: profile.phone,
              template: "garage_declined",
              variables: [profile.first_name ?? "there", updated.shortId],
              bookingId: id,
            });
      notificationOutcome = res.error ? "failed" : "sent";
    }

    await appendAuditEntry({
      action: "garage_respond",
      entityType: "booking",
      entityId: id,
      actor: session.sub,
      payload: { outcome, notificationOutcome },
      before: { status: before.status },
      outcome: "success",
    });
    return applyCorsHeaders(
      NextResponse.json({ booking: updated, notificationOutcome }),
      request,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "garage_respond",
      entityType: "booking",
      entityId: id,
      actor: session.sub,
      payload: { outcome },
      outcome: "error",
      error: message,
    });
    return applyCorsHeaders(
      NextResponse.json({ error: message }, { status: 400 }),
      request,
    );
  }
}

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}
