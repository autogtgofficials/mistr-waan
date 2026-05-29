import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateShortId } from "@/lib/supabase/short-id";
import type { Database, Json } from "@/lib/supabase/types";
import type { Booking, BookingGarage, BookingService, CreateBookingInput } from "./types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type GarageRow = Database["public"]["Tables"]["garages"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

/**
 * PostgREST select alias used when we want the garage in the same query.
 * The plain rows have `garage_id`; the join exposes `garage` as an alias.
 */
const SELECT_WITH_GARAGE = "*, garage:garages(*)";

function fromGarageRow(row: GarageRow): BookingGarage {
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

function fromServiceRow(row: ServiceRow): BookingService {
  return {
    id: row.id,
    name: row.name,
    basePrice: row.base_price,
    durationLabel: row.duration_label,
    blurb: row.blurb,
    isQuoted: row.is_quoted,
  };
}

/** Map DB row (with optional joined garage) → camelCase domain object. */
function fromRow(
  row: BookingRow & { garage?: GarageRow | null },
  services?: ServiceRow[],
): Booking {
  return {
    id: row.id,
    shortId: row.short_id,
    profileId: row.profile_id,
    bucket: row.bucket,
    serviceIds: row.service_ids,
    garageId: row.garage_id,
    garage: row.garage ? fromGarageRow(row.garage) : null,
    services: services?.map(fromServiceRow),
    slotDate: row.slot_date,
    slotTime: row.slot_time,
    slotLabel: row.slot_label,
    paymentMode: row.payment_mode,
    total: row.total,
    baseTotal: row.base_total,
    status: row.status,
    symptoms: (row.symptoms as Record<string, unknown> | null) ?? null,
    denting: (row.denting as Record<string, unknown> | null) ?? null,
    vehicleType: row.vehicle_type,
    vehicleBrand: row.vehicle_brand,
    vehicleModel: row.vehicle_model,
    vehicleRegistration: row.vehicle_registration,
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
  };
}

/**
 * Resolve a garage identifier — either a UUID or a slug like "g-imran-k" —
 * into the canonical UUID. Returns null if not found.
 *
 * Customer UIs currently carry the slug from the seed mocks; ops UIs use
 * UUIDs. Accept both so the booking POST endpoint doesn't care which one came in.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveGarageId(idOrSlug: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (UUID_RE.test(idOrSlug)) {
    const { data } = await supabase
      .from("garages")
      .select("id")
      .eq("id", idOrSlug)
      .maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await supabase
    .from("garages")
    .select("id")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return data?.id ?? null;
}

/** Fetch service catalog rows for a list of ids, preserving order. */
async function fetchServices(serviceIds: string[]): Promise<ServiceRow[]> {
  if (serviceIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .in("id", serviceIds);
  if (error) throw new Error(`services lookup failed: ${error.message}`);
  const byId = new Map((data ?? []).map((s) => [s.id, s] as const));
  return serviceIds.map((id) => byId.get(id)).filter((s): s is ServiceRow => Boolean(s));
}

/**
 * Compute baseTotal by summing the catalog price of every service_id.
 * Missing services price as 0 (they were probably deactivated; ops will quote).
 */
async function computeBaseTotal(serviceIds: string[]): Promise<number> {
  if (serviceIds.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("base_price")
    .in("id", serviceIds);
  if (error) throw new Error(`services lookup failed: ${error.message}`);
  return (data ?? []).reduce((acc, s) => acc + (s.base_price ?? 0), 0);
}

/**
 * Create a booking with a unique short_id, retrying once if we hit a
 * unique-violation collision (~1 in 887M).
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const supabase = getSupabaseAdmin();
  const baseTotal = await computeBaseTotal(input.serviceIds);

  for (let attempt = 0; attempt < 3; attempt++) {
    const shortId = generateShortId();
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        short_id: shortId,
        profile_id: input.profileId,
        bucket: input.bucket,
        service_ids: input.serviceIds,
        garage_id: input.garageId ?? null,
        slot_date: input.slotDate ?? null,
        slot_time: input.slotTime ?? null,
        slot_label: input.slotLabel,
        payment_mode: input.paymentMode,
        base_total: baseTotal,
        total: baseTotal, // will be adjusted by ops in quote step
        symptoms: (input.symptoms as Json) ?? null,
        denting: (input.denting as Json) ?? null,
        vehicle_type: input.vehicleType ?? null,
        vehicle_brand: input.vehicleBrand ?? null,
        vehicle_model: input.vehicleModel ?? null,
        vehicle_registration: input.vehicleRegistration ?? null,
      })
      .select("*")
      .single();
    if (!error && data) return fromRow(data);
    if (error?.code === "23505") continue; // short_id collision — retry
    throw new Error(`booking insert failed: ${error?.message ?? "unknown"}`);
  }
  throw new Error("booking insert failed: short_id collisions exceeded retry budget");
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT_WITH_GARAGE)
    .eq("id", id)
    .maybeSingle<BookingRow & { garage: GarageRow | null }>();
  if (error) throw new Error(`booking lookup failed: ${error.message}`);
  if (!data) return null;
  const services = await fetchServices(data.service_ids);
  return fromRow(data, services);
}

export async function getBookingByShortId(shortId: string): Promise<Booking | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT_WITH_GARAGE)
    .eq("short_id", shortId)
    .maybeSingle<BookingRow & { garage: GarageRow | null }>();
  if (error) throw new Error(`booking lookup failed: ${error.message}`);
  if (!data) return null;
  const services = await fetchServices(data.service_ids);
  return fromRow(data, services);
}

export async function listBookingsForProfile(profileId: string): Promise<Booking[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT_WITH_GARAGE)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .returns<(BookingRow & { garage: GarageRow | null })[]>();
  if (error) throw new Error(`bookings list failed: ${error.message}`);
  // Services not hydrated in the list view to keep the query lean — the
  // detail page calls getBookingById which does fetch them.
  return (data ?? []).map((r) => fromRow(r));
}
