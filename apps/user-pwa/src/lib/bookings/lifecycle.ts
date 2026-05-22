import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBookingById } from "./data";
import { incrementJobsCompleted } from "@/lib/garage/data";
import { maybeIssueReferralReward } from "@/lib/referrals/data";
import type { Booking } from "./types";

/**
 * Move a booking from `assigned` → `in_progress`. Caller (route handler)
 * is responsible for verifying the garage actually owns this booking and
 * sending the `job_started` WhatsApp template afterward.
 */
export async function startJob(bookingId: string): Promise<Booking> {
  const before = await getBookingById(bookingId);
  if (!before) throw new Error("booking not found");
  if (before.status !== "assigned") {
    throw new Error(`cannot start a ${before.status} booking`);
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "in_progress", in_progress_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) throw new Error(`start update failed: ${error.message}`);
  const refreshed = await getBookingById(bookingId);
  if (!refreshed) throw new Error("booking vanished after start update");
  return refreshed;
}

/**
 * Move a booking from `in_progress` → `completed`. Also bumps
 * `garages.jobs_completed`.
 */
export async function completeJob(bookingId: string): Promise<Booking> {
  const before = await getBookingById(bookingId);
  if (!before) throw new Error("booking not found");
  if (before.status !== "in_progress") {
    throw new Error(`cannot complete a ${before.status} booking`);
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) throw new Error(`complete update failed: ${error.message}`);

  if (before.garageId) {
    await incrementJobsCompleted(before.garageId);
  }

  // Fire-and-forget the referral reward path. We never want a referral
  // failure to surface as a complete-job error to the garage.
  void maybeIssueReferralReward({
    refereeProfileId: before.profileId,
    completedBookingId: bookingId,
  }).catch((err) =>
    console.error("[referral] maybeIssueReferralReward failed", err),
  );

  const refreshed = await getBookingById(bookingId);
  if (!refreshed) throw new Error("booking vanished after complete update");
  return refreshed;
}

/**
 * Cancel a booking. Customer-initiated (must be >1hr before slot) or
 * ops-initiated (no cutoff).
 *
 * Cancellation is allowed from any non-terminal status. Already-cancelled
 * or completed bookings are a no-op-with-error (callers can choose to ignore).
 */
export interface CancelOpts {
  bookingId: string;
  reason?: string | null;
  /** When true, the 1-hour-before-slot cutoff is enforced. */
  enforceCutoff: boolean;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function cancelJob(opts: CancelOpts): Promise<Booking> {
  const before = await getBookingById(opts.bookingId);
  if (!before) throw new Error("booking not found");
  if (
    before.status === "completed" ||
    before.status === "cancelled" ||
    before.status === "declined_by_garage"
  ) {
    throw new Error(`cannot cancel a ${before.status} booking`);
  }

  // Cutoff check uses slot_date + slot_time when present; falls back to
  // queued_for_call_at + 24h if the slot wasn't pinned to a specific time
  // (these are the early "ops will call you" slots).
  if (opts.enforceCutoff) {
    const slotTime = computeSlotInstant(before);
    if (slotTime != null) {
      const msUntilSlot = slotTime - Date.now();
      if (msUntilSlot < ONE_HOUR_MS) {
        throw new Error("cutoff_exceeded: less than 1 hour before slot");
      }
    }
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: opts.reason ?? null,
    })
    .eq("id", opts.bookingId);
  if (error) throw new Error(`cancel update failed: ${error.message}`);

  const refreshed = await getBookingById(opts.bookingId);
  if (!refreshed) throw new Error("booking vanished after cancel update");
  return refreshed;
}

/** Convert slot_date + slot_time → ms epoch. Returns null if either is missing. */
function computeSlotInstant(b: Booking): number | null {
  if (!b.slotDate || !b.slotTime) return null;
  // slot_time is HH:MM (24h) per the schema; combine in Asia/Kolkata.
  // We don't have a TZ lib, but Postgres stored it as text; assume IST.
  // Build "YYYY-MM-DDTHH:MM:00+05:30" and parse.
  const iso = `${b.slotDate}T${b.slotTime}:00+05:30`;
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
}
