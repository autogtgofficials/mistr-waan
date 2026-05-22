import { NextResponse } from "next/server";
import { getGarageSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { startJob } from "@/lib/bookings/lifecycle";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { applyCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

/** PATCH /api/garage/jobs/[id]/start — assigned → in_progress + WA. */
export async function PATCH(
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
    const updated = await startJob(id);

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("id", before.profileId)
      .maybeSingle();
    let notificationOutcome: "sent" | "skipped" | "failed" = "skipped";
    if (profile?.phone) {
      const res = await notifyTemplate({
        to: profile.phone,
        template: "job_started",
        variables: [profile.first_name ?? "there", updated.shortId],
        bookingId: id,
      });
      notificationOutcome = res.error ? "failed" : "sent";
    }

    await appendAuditEntry({
      action: "garage_start_job",
      entityType: "booking",
      entityId: id,
      actor: session.sub,
      payload: { notificationOutcome },
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
      action: "garage_start_job",
      entityType: "booking",
      entityId: id,
      actor: session.sub,
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
