import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { setQuote } from "@/lib/bookings/quote";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface QuoteBody {
  amount?: unknown;
  note?: unknown;
}

/**
 * PATCH /api/ops/bookings/[id]/quote
 *
 * Body: { amount: number, note?: string }
 *
 * Ops session required. Inserts a row into `quotes`, updates `bookings.total`
 * and (if currently queued_for_call) flips status to `quoted`, then notifies
 * the customer via the `booking_quoted` WhatsApp template.
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

  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return NextResponse.json(
      { error: "invalid_amount", detail: "amount must be 0–1,000,000" },
      { status: 400 },
    );
  }
  const note =
    typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim() : null;

  const before = await getBookingById(id);
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const actor = session.email ?? session.sub;
  try {
    const updated = await setQuote({
      bookingId: id,
      amount,
      note,
      setByActor: actor,
    });

    // Look up the customer phone so we can WhatsApp them. We grab it directly
    // (no profile join in the booking row) — simpler than threading another join.
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", before.profileId)
      .maybeSingle();

    let notificationOutcome: "sent" | "skipped" | "failed" = "skipped";
    if (profile?.phone) {
      const paymentLabel = before.paymentMode === "cash" ? "Cash on visit" : "UPI";
      const res = await notifyTemplate({
        to: profile.phone,
        template: "booking_quoted",
        variables: [before.shortId, `₹${amount}`, paymentLabel],
        bookingId: id,
      });
      notificationOutcome = res.error ? "failed" : "sent";
    }

    await appendAuditEntry({
      action: "set_quote",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { amount, note, notificationOutcome },
      before: { status: before.status, total: before.total },
      outcome: "success",
    });

    return NextResponse.json({ booking: updated, notificationOutcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "set_quote",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { amount, note },
      outcome: "error",
      error: message,
    });
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
