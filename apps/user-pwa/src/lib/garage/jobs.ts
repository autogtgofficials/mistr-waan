import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Booking } from "@/lib/bookings/types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

/**
 * Garage-side view of a booking. Adds a coarse customer label (no PII beyond
 * what the garage needs for the job) and the commission cut at the garage's
 * configured rate.
 */
export interface GarageJob extends Booking {
  customerLabel: string;
  customerArea: string;
  customerPhoneMasked: string;
  commissionCut: number | null;
}

function maskPhone(phone: string): string {
  // E.g. +916006617842 → "•••• 7842"
  return `•••• ${phone.slice(-4)}`;
}

function fromRow(args: {
  row: BookingRow;
  profile: ProfileRow | null;
  services: ServiceRow[];
  commissionPct: number;
}): GarageJob {
  const { row, profile, services, commissionPct } = args;
  const commissionCut =
    row.total != null ? Math.round(row.total * (commissionPct / 100)) : null;
  return {
    id: row.id,
    shortId: row.short_id,
    profileId: row.profile_id,
    bucket: row.bucket,
    serviceIds: row.service_ids,
    garageId: row.garage_id,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      basePrice: s.base_price,
      durationLabel: s.duration_label,
      blurb: s.blurb,
      isQuoted: s.is_quoted,
    })),
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
    customerLabel: profile?.first_name ?? "Customer",
    customerArea: "—", // We don't store the customer's area on the profile yet.
    customerPhoneMasked: profile ? maskPhone(profile.phone) : "—",
    commissionCut,
  };
}

/**
 * List every booking assigned to this garage (any status). Newest first.
 * The garage PWA buckets these client-side into pending / active / completed.
 */
export async function listGarageJobs(garageId: string): Promise<GarageJob[]> {
  const supabase = getSupabaseAdmin();

  const { data: garage } = await supabase
    .from("garages")
    .select("commission_pct")
    .eq("id", garageId)
    .maybeSingle();
  const commissionPct = Number(garage?.commission_pct ?? 12);

  const { data: rows, error } = await supabase
    .from("bookings")
    .select("*, profile:profiles!inner(*)")
    .eq("garage_id", garageId)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<(BookingRow & { profile: ProfileRow })[]>();
  if (error) throw new Error(`garage jobs list failed: ${error.message}`);

  // Hydrate services once for the whole batch.
  const allServiceIds = Array.from(new Set((rows ?? []).flatMap((r) => r.service_ids)));
  let servicesById = new Map<string, ServiceRow>();
  if (allServiceIds.length > 0) {
    const { data: serviceRows } = await supabase
      .from("services")
      .select("*")
      .in("id", allServiceIds);
    servicesById = new Map((serviceRows ?? []).map((s) => [s.id, s] as const));
  }

  return (rows ?? []).map((row) =>
    fromRow({
      row,
      profile: row.profile,
      services: row.service_ids
        .map((id) => servicesById.get(id))
        .filter((s): s is ServiceRow => Boolean(s)),
      commissionPct,
    }),
  );
}

export async function getGarageJobById(args: {
  garageId: string;
  bookingId: string;
}): Promise<GarageJob | null> {
  const supabase = getSupabaseAdmin();

  const { data: garage } = await supabase
    .from("garages")
    .select("commission_pct")
    .eq("id", args.garageId)
    .maybeSingle();
  const commissionPct = Number(garage?.commission_pct ?? 12);

  const { data: row, error } = await supabase
    .from("bookings")
    .select("*, profile:profiles!inner(*)")
    .eq("id", args.bookingId)
    .eq("garage_id", args.garageId)
    .maybeSingle<BookingRow & { profile: ProfileRow }>();
  if (error) throw new Error(`garage job lookup failed: ${error.message}`);
  if (!row) return null;

  const { data: serviceRows } = await supabase
    .from("services")
    .select("*")
    .in("id", row.service_ids);

  return fromRow({
    row,
    profile: row.profile,
    services: serviceRows ?? [],
    commissionPct,
  });
}
