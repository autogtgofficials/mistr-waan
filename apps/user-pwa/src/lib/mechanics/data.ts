// Server-only data access for mechanics — backed by the Supabase `mechanics`
// table (migrated from the scraped JSON via tools/migrate-mechanics-to-supabase).
// Consumed by the ops map + coverage views and the /api/mechanics routes.

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type {
  Mechanic,
  OnboardingStatus,
  ReverseGeocode,
  ServiceTag,
} from "./types";

type MechanicRow = Database["public"]["Tables"]["mechanics"]["Row"];

function fromRow(r: MechanicRow): Mechanic {
  return {
    id: r.id,
    source: r.source as Mechanic["source"],
    sourceId: r.source_id ?? "",
    osmType: (r.osm_type ?? "node") as Mechanic["osmType"],
    name: r.name,
    shopName: r.shop_name,
    phones: r.phones ?? [],
    email: r.email,
    website: r.website,
    address: r.address,
    area: r.area,
    areaSource: (r.area_source ?? undefined) as Mechanic["areaSource"],
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    services: (r.services ?? []) as ServiceTag[],
    openingHours: r.opening_hours,
    rating: r.osm_rating,
    reviewCount: r.review_count,
    onboardingStatus: r.onboarding_status as OnboardingStatus,
    notes: r.notes,
    rawTags: (r.raw_tags as Record<string, string> | null) ?? {},
    reverseGeocode: (r.reverse_geocode as ReverseGeocode | null) ?? undefined,
    scrapedAt: r.scraped_at ?? "",
    lastUpdatedAt: r.last_updated_at ?? "",
  };
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mechanics")
    .select("*")
    .limit(2000);
  if (error) throw new Error(`mechanics list failed: ${error.message}`);
  return (data ?? []).map(fromRow);
}

export async function getMechanic(id: string): Promise<Mechanic | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mechanics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`mechanic lookup failed: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function updateMechanic(
  id: string,
  patch: { onboardingStatus?: OnboardingStatus; notes?: string | null },
): Promise<Mechanic | null> {
  const supabase = getSupabaseAdmin();
  const update: Database["public"]["Tables"]["mechanics"]["Update"] = {
    last_updated_at: new Date().toISOString(),
  };
  if (patch.onboardingStatus !== undefined) {
    update.onboarding_status = patch.onboardingStatus;
  }
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("mechanics")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`mechanic update failed: ${error.message}`);
  return data ? fromRow(data) : null;
}
