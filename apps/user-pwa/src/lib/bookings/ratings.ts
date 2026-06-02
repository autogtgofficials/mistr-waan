import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBookingById } from "./data";
import type { Booking } from "./types";

/**
 * Customer rates a completed booking. Inserts into the `ratings` table
 * (target='garage', unique-per-booking) AND mirrors the score onto
 * `bookings.rating_value` for quick display. Then recomputes the garage's
 * aggregate rating from all rated completed bookings.
 *
 * Returns the refreshed booking.
 */
export interface AddRatingOpts {
  bookingId: string;
  profileId: string;
  score: number;
  comment?: string | null;
}

export async function addBookingRating(opts: AddRatingOpts): Promise<Booking> {
  if (!Number.isFinite(opts.score) || opts.score < 1 || opts.score > 5) {
    throw new Error("score must be 1–5");
  }
  const before = await getBookingById(opts.bookingId);
  if (!before) throw new Error("booking not found");
  if (before.profileId !== opts.profileId) {
    throw new Error("forbidden");
  }
  if (before.status !== "completed") {
    throw new Error(`cannot rate a ${before.status} booking`);
  }
  if (!before.garageId) {
    throw new Error("no_garage");
  }
  if (before.ratingValue != null) {
    throw new Error("already_rated");
  }

  const supabase = getSupabaseAdmin();

  // 1. Insert the ratings row. Unique constraint on booking_id means we can
  //    only insert once — that's our concurrency guard.
  const { error: insertErr } = await supabase.from("ratings").insert({
    booking_id: opts.bookingId,
    profile_id: opts.profileId,
    garage_id: before.garageId,
    score: opts.score,
    comment: opts.comment ?? null,
    target: "garage",
  });
  if (insertErr) {
    if (insertErr.code === "23505") throw new Error("already_rated");
    throw new Error(`rating insert failed: ${insertErr.message}`);
  }

  // 2. Mirror onto bookings for quick display.
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({
      rating_value: opts.score,
      rating_comment: opts.comment ?? null,
    })
    .eq("id", opts.bookingId);
  if (updateErr) throw new Error(`booking update failed: ${updateErr.message}`);

  // 3. Recompute the garage aggregate. Cheap at our scale — pulls every
  //    rating row for the garage and averages. A Postgres function would be
  //    nicer at 10x our volume.
  await recomputeGarageRating(before.garageId);

  const refreshed = await getBookingById(opts.bookingId);
  if (!refreshed) throw new Error("booking vanished after rating");
  return refreshed;
}

export interface GarageReview {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  reviewerFirstName: string | null;
}

/**
 * Recent customer reviews for a garage — real `ratings` rows (target='garage'),
 * newest first, with the reviewer's first name (no last name in `profiles`).
 * Used by the public garage detail page.
 */
export async function getReviewsByGarage(
  garageId: string,
  limit = 5,
): Promise<GarageReview[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ratings")
    .select("id, score, comment, created_at, profile:profiles(first_name)")
    .eq("garage_id", garageId)
    .eq("target", "garage")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`reviews fetch failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const profile = r.profile as { first_name: string | null } | null;
    return {
      id: r.id,
      score: r.score,
      comment: r.comment,
      createdAt: r.created_at,
      reviewerFirstName: profile?.first_name ?? null,
    };
  });
}

export async function recomputeGarageRating(garageId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ratings")
    .select("score")
    .eq("garage_id", garageId)
    .eq("target", "garage");
  if (error) throw new Error(`ratings fetch failed: ${error.message}`);

  if (!data || data.length === 0) return 0;
  const avg = data.reduce((acc, r) => acc + r.score, 0) / data.length;
  const rounded = Math.round(avg * 10) / 10; // one decimal

  const { error: updateErr } = await supabase
    .from("garages")
    .update({ rating: rounded })
    .eq("id", garageId);
  if (updateErr) throw new Error(`garage rating update failed: ${updateErr.message}`);
  return rounded;
}
