import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  phone: string;
  firstName: string | null;
  language: string | null;
  referralCode: string | null;
  referredBy: string | null;
  loyaltyPoints: number;
  createdAt: string;
  lastSeenAt: string | null;
}

/**
 * Find a profile by phone, or create one if none exists.
 * Touches `last_seen_at` on every call so we have a recency signal.
 */
export async function upsertProfileByPhone(phone: string): Promise<Profile> {
  const supabase = getSupabaseAdmin();

  // Try insert first, ignore conflict, then read back.
  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ phone })
    .select("id")
    .maybeSingle();

  // ignore unique violation (23505); rethrow everything else
  if (insertError && insertError.code !== "23505") {
    throw new Error(`profile insert failed: ${insertError.message}`);
  }

  const { data: row, error: selectError } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("phone", phone)
    .select("*")
    .single();

  if (selectError || !row) {
    throw new Error(`profile select failed: ${selectError?.message ?? "no row"}`);
  }

  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    language: row.language,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    loyaltyPoints: row.loyalty_points,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

/** Lookup by phone — used by the WhatsApp bot to identify the caller without
 * mutating anything. Returns null if the phone hasn't booked before. */
export async function findProfileByPhone(phone: string): Promise<Profile | null> {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    language: row.language,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    loyaltyPoints: row.loyalty_points,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

/** Lookup by id (used by /api/auth/me). */
export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    language: row.language,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    loyaltyPoints: row.loyalty_points,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}
