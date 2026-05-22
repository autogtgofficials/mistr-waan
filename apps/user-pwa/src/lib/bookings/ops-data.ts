import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Booking, BookingBucket, BookingStatus } from "./types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type GarageRow = Database["public"]["Tables"]["garages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Ops-side booking list. Includes profile + garage joins so the dashboard
 * can render customer name + garage name without a second round-trip.
 */

export interface OpsBookingRow extends Booking {
  customerPhone: string;
  customerFirstName: string | null;
}

export interface ListOpsBookingsOpts {
  status?: BookingStatus | "all";
  bucket?: BookingBucket | "all";
  limit?: number;
}

function fromGarage(row: GarageRow) {
  return {
    id: row.id,
    slug: row.slug,
    ownerFirstName: row.owner_first_name,
    ownerLastName: row.owner_last_name,
    shopName: row.shop_name,
    area: row.area,
    fullAddress: row.full_address,
    rating: Number(row.rating),
    jobsCompleted: row.jobs_completed,
  };
}

function fromRow(
  row: BookingRow & { garage: GarageRow | null; profile: ProfileRow },
): OpsBookingRow {
  return {
    id: row.id,
    shortId: row.short_id,
    profileId: row.profile_id,
    bucket: row.bucket,
    serviceIds: row.service_ids,
    garageId: row.garage_id,
    garage: row.garage ? fromGarage(row.garage) : null,
    slotDate: row.slot_date,
    slotTime: row.slot_time,
    slotLabel: row.slot_label,
    paymentMode: row.payment_mode,
    total: row.total,
    baseTotal: row.base_total,
    status: row.status,
    symptoms: (row.symptoms as Record<string, unknown> | null) ?? null,
    denting: (row.denting as Record<string, unknown> | null) ?? null,
    cancellationReason: row.cancellation_reason,
    ratingValue: row.rating_value,
    ratingComment: row.rating_comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    queuedForCallAt: row.queued_for_call_at,
    quotedAt: row.quoted_at,
    assignedAt: row.assigned_at,
    inProgressAt: row.in_progress_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    customerPhone: row.profile.phone,
    customerFirstName: row.profile.first_name,
  };
}

export async function listOpsBookings(
  opts: ListOpsBookingsOpts = {},
): Promise<OpsBookingRow[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("bookings")
    .select("*, garage:garages(*), profile:profiles!inner(*)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.bucket && opts.bucket !== "all") q = q.eq("bucket", opts.bucket);
  const { data, error } = await q.returns<
    (BookingRow & { garage: GarageRow | null; profile: ProfileRow })[]
  >();
  if (error) throw new Error(`ops bookings list failed: ${error.message}`);
  return (data ?? []).map(fromRow);
}
