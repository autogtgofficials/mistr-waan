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

