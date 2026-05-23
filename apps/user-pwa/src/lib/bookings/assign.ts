import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBookingById, resolveGarageId } from "./data";
import type { Booking } from "./types";

/**
 * Assign a garage to a booking. Sets `garage_id`, flips status to
 * `awaiting_garage`, and stamps `assigned_at`.
 *
 * The actual transition to `assigned` happens when the garage replies ACCEPT
 * either in WhatsApp or in the garage PWA — see `respondToAssignment` (week 3)
 * and the webhook intent router.
 *
 * `garageIdOrSlug` can be a UUID or a slug (e.g. "g-imran-k") — the data
 * layer's `resolveGarageId` normalises it.
 */
export async function assignGarage(opts: {
  bookingId: string;
  garageIdOrSlug: string;
}): Promise<Booking> {
  const existing = await getBookingById(opts.bookingId);
  if (!existing) throw new Error("booking not found");
  if (existing.status !== "quoted" && existing.status !== "awaiting_garage") {
    // Ops can re-assign if a previous garage declined — that's the
    // `awaiting_garage` case. But trying to assign a queued_for_call,
    // assigned, in_progress, completed, or cancelled booking is a mistake.
    throw new Error(
      `cannot assign garage to a ${existing.status} booking — quote it first`,
    );
  }

  const garageId = await resolveGarageId(opts.garageIdOrSlug);
  if (!garageId) throw new Error(`garage not found: ${opts.garageIdOrSlug}`);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bookings")
    .update({
      garage_id: garageId,
      status: "awaiting_garage",
      assigned_at: new Date().toISOString(),
    })
    .eq("id", opts.bookingId);
  if (error) throw new Error(`assign update failed: ${error.message}`);

  const refreshed = await getBookingById(opts.bookingId);
  if (!refreshed) throw new Error("booking vanished after assign update");
  return refreshed;
}

/**
 * Mark a previously-assigned garage's response. Called by both:
 *  - the WhatsApp webhook intent router when the garage taps Accept/Decline
 *  - the garage PWA when the owner taps Accept/Decline
 *
 * On accept → status moves to `assigned`. On decline → `declined_by_garage`,
 * `garage_id` is cleared so ops can reassign without confusion.
 */
export async function respondToAssignment(opts: {
  bookingId: string;
  garageId: string;
  outcome: "accept" | "decline";
}): Promise<Booking> {
  const existing = await getBookingById(opts.bookingId);
  if (!existing) throw new Error("booking not found");
  if (existing.garageId !== opts.garageId) {
    throw new Error("garage is not assigned to this booking");
  }
  if (existing.status !== "awaiting_garage") {
    throw new Error(`cannot respond to a ${existing.status} booking`);
  }

  const supabase = getSupabaseAdmin();
  const update =
    opts.outcome === "accept"
      ? { status: "assigned" as const }
      : {
          status: "declined_by_garage" as const,
          // Don't clear garage_id — ops needs to see who declined.
        };
  const { error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", opts.bookingId);
  if (error) throw new Error(`respond update failed: ${error.message}`);

  const refreshed = await getBookingById(opts.bookingId);
  if (!refreshed) throw new Error("booking vanished after respond update");
  return refreshed;
}
