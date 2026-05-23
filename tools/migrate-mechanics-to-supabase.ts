#!/usr/bin/env tsx
/**
 * One-shot ETL: apps/ops/data/mechanics.json + overrides.json → Supabase mechanics table.
 *
 * Idempotent — uses `upsert` keyed on id. Safe to re-run after edits.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx tools/migrate-mechanics-to-supabase.ts
 *
 * Reads files relative to repo root, so cwd must be the monorepo root.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const REPO_ROOT = process.cwd();
const MECHANICS_PATH = resolve(REPO_ROOT, "apps/ops/data/mechanics.json");
const OVERRIDES_PATH = resolve(REPO_ROOT, "apps/ops/data/overrides.json");

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "[migrate] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.",
  );
  process.exit(1);
}

interface RawMechanic {
  id: string;
  source: string;
  sourceId?: string;
  osmType: string;
  name: string;
  shopName: string | null;
  phones: string[];
  email: string | null;
  website: string | null;
  address: string | null;
  area: string | null;
  areaSource?: string;
  lat: number;
  lng: number;
  services: string[];
  openingHours: string | null;
  rating: number | null;
  reviewCount: number | null;
  onboardingStatus: string;
  notes: string | null;
  rawTags: Record<string, unknown>;
  reverseGeocode?: Record<string, unknown>;
  scrapedAt: string;
  lastUpdatedAt: string;
}

interface RawOverride {
  onboardingStatus?: string;
  notes?: string | null;
  outreachOutcome?: string;
  detailedServices?: string[];
  pricing?: unknown;
  coverageAreas?: string[];
  businessProfile?: unknown;
  callLog?: unknown;
  nextFollowUpAt?: string | null;
  nextFollowUpNote?: string | null;
  tags?: string[];
  updatedAt: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function rowFor(m: RawMechanic, o: RawOverride | undefined) {
  return {
    id: m.id,
    source: m.source,
    source_id: m.sourceId ?? null,
    osm_type: m.osmType ?? null,
    name: m.name,
    shop_name: m.shopName ?? null,
    phones: Array.isArray(m.phones) ? m.phones : [],
    email: m.email ?? null,
    website: m.website ?? null,
    address: m.address ?? null,
    area: m.area ?? null,
    area_source: m.areaSource ?? null,
    lat: m.lat,
    lng: m.lng,
    services: Array.isArray(m.services) ? m.services : [],
    opening_hours: m.openingHours ?? null,
    osm_rating: m.rating ?? null,
    review_count: m.reviewCount ?? null,
    onboarding_status: o?.onboardingStatus ?? m.onboardingStatus ?? "not_contacted",
    notes: o?.notes ?? m.notes ?? null,
    outreach_outcome: o?.outreachOutcome ?? null,
    detailed_services: o?.detailedServices ?? null,
    coverage_areas: o?.coverageAreas ?? null,
    pricing: (o?.pricing as never) ?? null,
    business_profile: (o?.businessProfile as never) ?? null,
    call_log: (o?.callLog as never) ?? null,
    next_follow_up_at: o?.nextFollowUpAt ?? null,
    next_follow_up_note: o?.nextFollowUpNote ?? null,
    tags: o?.tags ?? null,
    raw_tags: (m.rawTags ?? null) as never,
    reverse_geocode: (m.reverseGeocode ?? null) as never,
    scraped_at: m.scrapedAt ?? new Date().toISOString(),
    last_updated_at: m.lastUpdatedAt ?? new Date().toISOString(),
  };
}

async function main() {
  const mechanics = readJson<RawMechanic[]>(MECHANICS_PATH);
  const overrides = readJson<Record<string, RawOverride>>(OVERRIDES_PATH);
  console.log(`[migrate] Loaded ${mechanics.length} mechanics, ${Object.keys(overrides).length} overrides.`);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false },
  });

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < mechanics.length; i += BATCH) {
    const batch = mechanics.slice(i, i + BATCH).map((m) => rowFor(m, overrides[m.id]));
    const { error } = await supabase.from("mechanics").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`[migrate] batch ${i / BATCH + 1} failed:`, error.message);
      process.exit(2);
    }
    inserted += batch.length;
    console.log(`[migrate] upserted ${inserted}/${mechanics.length}`);
  }

  console.log("[migrate] Done.");
}

void main().catch((err) => {
  console.error("[migrate] crashed:", err);
  process.exit(1);
});
