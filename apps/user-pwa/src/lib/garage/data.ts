import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type GarageRow = Database["public"]["Tables"]["garages"]["Row"];

/**
 * Garage data layer used by the `/api/garage/*` routes.
 *
 * Garages are onboarded by ops (not self-signup), so we lookup-only.
 * Login flow: garage owner enters their phone → we verify the phone exists
 * in `garages.phone` or `garages.whatsapp_phone` → send OTP → set session
 * cookie with `sub = garage.id`.
 */

export type GarageOnboardingStatus =
  Database["public"]["Enums"]["garage_onboarding_status"];

export interface Garage {
  id: string;
  slug: string | null;
  shopName: string;
  ownerFirstName: string;
  ownerLastName: string;
  area: string;
  fullAddress: string;
  phone: string;
  whatsappPhone: string | null;
  rating: number;
  jobsCompleted: number;
  commissionPct: number;
  serviceBuckets: string[];
  active: boolean;
  // Phase 5 (blueprint alignment) — all optional for back-compat with
  // garages onboarded before the migration.
  onboardingStatus: GarageOnboardingStatus | null;
  workingHours: string | null;
  weeklyOff: string | null;
  rsaAvailable: boolean | null;
  rsaRadiusKm: number | null;
  pickupAvailable: boolean | null;
  verificationDocPath: string | null;
}

function fromRow(row: GarageRow): Garage {
  return {
    id: row.id,
    slug: row.slug,
    shopName: row.shop_name,
    ownerFirstName: row.owner_first_name,
    ownerLastName: row.owner_last_name,
    area: row.area,
    fullAddress: row.full_address,
    phone: row.phone,
    whatsappPhone: row.whatsapp_phone,
    rating: Number(row.rating),
    jobsCompleted: row.jobs_completed,
    commissionPct: Number(row.commission_pct),
    serviceBuckets: row.service_buckets,
    active: row.active,
    onboardingStatus: row.onboarding_status,
    workingHours: row.working_hours,
    weeklyOff: row.weekly_off,
    rsaAvailable: row.rsa_available,
    rsaRadiusKm: row.rsa_radius_km,
    pickupAvailable: row.pickup_available,
    verificationDocPath: row.verification_doc_path,
  };
}

/** Strip non-digits so "+91 7889 686 682" and "917889686682" compare equal. */
function normalisePhone(p: string): string {
  return p.replace(/\D+/g, "");
}

/**
 * Find an active garage whose `phone` or `whatsapp_phone` matches the given
 * phone (after stripping non-digits + suffix-matching the last 10 digits).
 * Used by the garage OTP flow.
 *
 * Returns null if the phone isn't onboarded — these owners need to be added
 * via ops before they can sign in.
 */
export async function findGarageByPhone(phone: string): Promise<Garage | null> {
  const supabase = getSupabaseAdmin();
  const digits = normalisePhone(phone);
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return null;

  // We can't do a normalised match in Postgres without a function. Fetch a
  // candidate set with a like-suffix match, then exact-compare in memory.
  // `phone` columns are short text; performance is fine at our scale.
  const { data, error } = await supabase
    .from("garages")
    .select("*")
    .or(`phone.ilike.%${last10},whatsapp_phone.ilike.%${last10}`)
    .eq("active", true);
  if (error) throw new Error(`garage lookup failed: ${error.message}`);

  const matches = (data ?? []).filter((row) => {
    const phoneDigits = normalisePhone(row.phone);
    const waDigits = row.whatsapp_phone ? normalisePhone(row.whatsapp_phone) : "";
    return (
      phoneDigits.slice(-10) === last10 ||
      (waDigits && waDigits.slice(-10) === last10)
    );
  });
  if (matches.length === 0) return null;
  return fromRow(matches[0]);
}

export async function getGarageById(id: string): Promise<Garage | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`garage lookup failed: ${error.message}`);
  if (!data) return null;
  return fromRow(data);
}

/** Toggle whether the garage is accepting new assignments. Used by the
 *  WhatsApp PAUSE / RESUME commands and by ops manually. When `active=false`
 *  ops's assign form filters this garage out; existing assignments stay.
 */
export async function setGarageActive(garageId: string, active: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("garages")
    .update({ active })
    .eq("id", garageId);
  if (error) throw new Error(`garage active update failed: ${error.message}`);
}

/** List the distinct active areas across all active garages. Used by the
 *  customer wizard's PICKING_AREA step to offer the right options.
 */
export async function listActiveAreas(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garages")
    .select("area")
    .eq("active", true);
  if (error) throw new Error(`areas list failed: ${error.message}`);
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.area);
  return Array.from(set).sort();
}

/** Active garages in a given area that support the requested bucket.
 *  Ordered by rating desc so the top picks are first in the numbered list.
 */
export async function listGaragesByAreaAndBucket(opts: {
  area: string;
  bucket: string;
  limit?: number;
}): Promise<Garage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garages")
    .select("*")
    .eq("active", true)
    .eq("area", opts.area)
    // service_buckets is text[]; use contains so we can pass the picked bucket.
    .contains("service_buckets", [opts.bucket])
    .order("rating", { ascending: false })
    .limit(opts.limit ?? 10);
  if (error) throw new Error(`garages by area failed: ${error.message}`);
  return (data ?? []).map(fromRow);
}

/** Lightweight list of active garages for the ops create-booking dropdown. */
export async function listActiveGarages(): Promise<Garage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garages")
    .select("*")
    .eq("active", true)
    .order("area")
    .order("shop_name");
  if (error) throw new Error(`active garages list failed: ${error.message}`);
  return (data ?? []).map(fromRow);
}

/** List garages by onboarding status — used by the ops review UI. */
export async function listGaragesByOnboardingStatus(
  status: GarageOnboardingStatus,
): Promise<Garage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garages")
    .select("*")
    .eq("onboarding_status", status)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`garages list failed: ${error.message}`);
  return (data ?? []).map(fromRow);
}

/** Update onboarding status + active flag together. Used by the ops
 *  Activate / Reject buttons.
 */
export async function setGarageOnboardingStatus(opts: {
  garageId: string;
  status: GarageOnboardingStatus;
  active?: boolean;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const update: { onboarding_status: GarageOnboardingStatus; active?: boolean } = {
    onboarding_status: opts.status,
  };
  if (typeof opts.active === "boolean") update.active = opts.active;
  const { error } = await supabase.from("garages").update(update).eq("id", opts.garageId);
  if (error) throw new Error(`garage onboarding update failed: ${error.message}`);
}

/** Atomic +1 to garages.jobs_completed when a job finishes. */
export async function incrementJobsCompleted(garageId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  // Postgres has no native "increment" in supabase-js; fetch + write.
  // OK for our scale; the only racer would be back-to-back completions from
  // the same garage, which the booking-status check elsewhere already serialises.
  const { data, error: readErr } = await supabase
    .from("garages")
    .select("jobs_completed")
    .eq("id", garageId)
    .maybeSingle();
  if (readErr) throw new Error(`garage read failed: ${readErr.message}`);
  if (!data) return;
  const { error: updateErr } = await supabase
    .from("garages")
    .update({ jobs_completed: data.jobs_completed + 1 })
    .eq("id", garageId);
  if (updateErr) throw new Error(`garage update failed: ${updateErr.message}`);
}

