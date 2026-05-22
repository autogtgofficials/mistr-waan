import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBookingById } from "./data";
import type { Booking } from "./types";

/**
 * Set or adjust the price quote on a booking. Inserts a row into `quotes`
 * (history of changes) and updates `bookings.total` + `bookings.status` to
 * `quoted` (if currently `queued_for_call`) or leaves status alone (if a
 * later step has already been reached).
 *
 * Returns the refreshed booking.
 *
 * Throws if the booking doesn't exist, the amount is outside [0, 1_000_000],
 * or the booking is in a terminal state where quoting no longer makes sense.
 */
export async function setQuote(opts: {
  bookingId: string;
  amount: number;
  note?: string | null;
  setByActor: string;
  source?: "ops_manual" | "ops_adjusted";
}): Promise<Booking> {
  if (!Number.isFinite(opts.amount) || opts.amount < 0 || opts.amount > 1_000_000) {
    throw new Error("amount must be a finite number between 0 and 1,000,000");
  }
  const supabase = getSupabaseAdmin();

  const existing = await getBookingById(opts.bookingId);
  if (!existing) throw new Error("booking not found");
  if (
    existing.status === "completed" ||
    existing.status === "cancelled" ||
    existing.status === "declined_by_garage"
  ) {
    throw new Error(`cannot quote a ${existing.status} booking`);
  }

  // Source defaults: first quote on a queued_for_call booking is the manual one;
  // any subsequent change is an adjustment.
  const source =
    opts.source ?? (existing.status === "queued_for_call" ? "ops_manual" : "ops_adjusted");

  // 1. Append history row.
  const { error: quoteErr } = await supabase.from("quotes").insert({
    booking_id: opts.bookingId,
    amount: opts.amount,
    note: opts.note ?? null,
    set_by_actor: opts.setByActor,
    source,
  });
  if (quoteErr) throw new Error(`quote insert failed: ${quoteErr.message}`);

  // 2. Update booking total + maybe status.
  const nextStatus = existing.status === "queued_for_call" ? "quoted" : existing.status;
  const update: {
    total: number;
    status?: typeof existing.status;
    quoted_at?: string;
  } = { total: opts.amount };
  if (nextStatus !== existing.status) {
    update.status = nextStatus;
    update.quoted_at = new Date().toISOString();
  }
  const { error: updateErr } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", opts.bookingId);
  if (updateErr) throw new Error(`booking update failed: ${updateErr.message}`);

  const refreshed = await getBookingById(opts.bookingId);
  if (!refreshed) throw new Error("booking vanished after quote update");
  return refreshed;
}
