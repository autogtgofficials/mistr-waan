#!/usr/bin/env node
// Multi-source mechanic discovery for Srinagar.
// Run:  node tools/scrape-mechanics/aggregate.mjs
//
// Combines:
//   - OSM Overpass (wider bbox + many more tags)
//   - Nominatim text search (~20 keyword variants)
//   - Justdial (best-effort HTML parse)
// Dedupes across sources and writes data/srinagar.json.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeOsmWide, normaliseOsmElement } from "./sources/osm-wide.mjs";
import { scrapeNominatim } from "./sources/nominatim.mjs";
import { scrapeJustdial } from "./sources/justdial.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "data");
const OUT_PATH = join(OUT_DIR, "srinagar.json");
const RAW_PATH = join(OUT_DIR, "raw-all.json");

const SERVICE_KEYWORDS = [
  { match: /detail|polish|ceramic|foam/i, service: "detailing" },
  { match: /dent|paint|body shop|denting/i, service: "denting" },
  { match: /tyre|tire|puncture|wheel align/i, service: "tyres" },
  { match: /spare|part/i, service: "parts" },
  { match: /wash/i, service: "car_wash" },
  { match: /service center|service centre|garage|workshop|motors|automobile|auto|mechanic|repair/i, service: "repair" },
];

function inferServices(item) {
  const tags = item.rawTags ?? {};
  const out = new Set();
  if (tags.amenity === "car_repair") out.add("repair");
  if (tags.shop === "car_repair") out.add("repair");
  if (tags.shop === "tyres") out.add("tyres");
  if (tags.shop === "car_parts") out.add("parts");
  if (tags.shop === "car") out.add("dealer");
  if (tags.shop === "motorcycle" || tags.shop === "motorcycle_repair") out.add("motorcycle");
  if (tags.amenity === "car_wash") out.add("car_wash");
  if (tags["service:vehicle:body_repair"] === "yes" || tags["service:vehicle:painting"] === "yes" || tags["service:vehicle:dent_removal"] === "yes")
    out.add("denting");
  if (tags["service:vehicle:tyres"] === "yes") out.add("tyres");
  if (tags["service:vehicle:car_wash"] === "yes") out.add("car_wash");
  if (tags["service:vehicle:repair"] === "yes") out.add("repair");

  const text = [item.name, item.address, tags.description].filter(Boolean).join(" ");
  for (const { match, service } of SERVICE_KEYWORDS) {
    if (match.test(text)) out.add(service);
  }
  if (out.size === 0) out.add("unknown");
  return [...out];
}

function normalisePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/[^\d]/g, "");
  if (!digits) return null;
  // Strip leading 91 / 0 to a canonical 10-digit form for India.
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

function normaliseName(n) {
  if (!n) return "";
  return n
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Merge a list of raw candidates from different sources, returning a single
 * mechanic per real-world entity. Dedup keys (in order):
 *   1. Phone number (normalised)
 *   2. Same coords within 50m AND >70% name similarity
 *   3. Same coords within 30m (different brands at same spot still merge —
 *      OSM sometimes has overlapping tags)
 */
function dedupe(candidates, onLog) {
  const merged = [];
  const phoneIndex = new Map(); // phone → index into merged
  const sourceCounts = {};

  function similarName(a, b) {
    const na = normaliseName(a);
    const nb = normaliseName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    // Token-overlap heuristic
    const ta = new Set(na.split(" "));
    const tb = new Set(nb.split(" "));
    const inter = [...ta].filter((t) => tb.has(t) && t.length > 2).length;
    const min = Math.min(ta.size, tb.size);
    return min > 0 && inter / min > 0.6;
  }

  for (const cand of candidates) {
    sourceCounts[cand.source] = (sourceCounts[cand.source] ?? 0) + 1;
    const phones = (cand.phones ?? []).map(normalisePhone).filter(Boolean);

    // 1. Phone match
    let matchIdx = -1;
    for (const p of phones) {
      if (phoneIndex.has(p)) {
        matchIdx = phoneIndex.get(p);
        break;
      }
    }

    // 2/3. Coord + name match
    if (matchIdx === -1 && Number.isFinite(cand.lat) && Number.isFinite(cand.lng)) {
      for (let i = 0; i < merged.length; i++) {
        const m = merged[i];
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
        const d = haversineMeters(cand, m);
        if (d < 30) {
          matchIdx = i;
          break;
        }
        if (d < 80 && similarName(cand.name, m.name)) {
          matchIdx = i;
          break;
        }
      }
    }

    // 4. Pure name+address overlap (no coords on cand or m)
    if (matchIdx === -1 && !Number.isFinite(cand.lat)) {
      for (let i = 0; i < merged.length; i++) {
        const m = merged[i];
        if (similarName(cand.name, m.name)) {
          matchIdx = i;
          break;
        }
      }
    }

    if (matchIdx === -1) {
      // New entity
      const obj = {
        ...cand,
        phones: [...new Set(phones)],
        sources: [{ source: cand.source, id: cand.sourceId ?? cand.id }],
      };
      merged.push(obj);
      const idx = merged.length - 1;
      for (const p of phones) phoneIndex.set(p, idx);
    } else {
      // Merge into existing
      const m = merged[matchIdx];
      // Prefer entries that have coords
      if (!Number.isFinite(m.lat) && Number.isFinite(cand.lat)) {
        m.lat = cand.lat;
        m.lng = cand.lng;
      }
      // Phone union
      const phoneSet = new Set(m.phones);
      for (const p of phones) phoneSet.add(p);
      m.phones = [...phoneSet];
      for (const p of phones) phoneIndex.set(p, matchIdx);
      // Prefer longer address
      if ((!m.address || (cand.address?.length ?? 0) > m.address.length) && cand.address) {
        m.address = cand.address;
      }
      // Website fill-in
      if (!m.website && cand.website) m.website = cand.website;
      // Merge raw tags
      m.rawTags = { ...(cand.rawTags ?? {}), ...(m.rawTags ?? {}) };
      m.sources.push({ source: cand.source, id: cand.sourceId ?? cand.id });
    }
  }

  onLog?.(`Sources contributed:`);
  for (const [s, c] of Object.entries(sourceCounts)) onLog?.(`   ${s}: ${c}`);
  onLog?.(`Unique entities after dedup: ${merged.length}`);
  return merged;
}

function buildMechanic(item, now) {
  return {
    id:
      item.sources?.[0]?.id?.startsWith("place/")
        ? `nom-${item.sources[0].id.split("/")[1]}`
        : item.id,
    source: item.sources?.[0]?.source ?? item.source,
    sources: item.sources ?? [{ source: item.source, id: item.sourceId ?? item.id }],
    osmType: item.osmType ?? null,
    name: item.name,
    shopName: null,
    phones: item.phones ?? [],
    email: null,
    website: item.website ?? null,
    address: item.address ?? null,
    area: null,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    services: inferServices(item),
    openingHours: null,
    rating: null,
    reviewCount: null,
    onboardingStatus: "not_contacted",
    notes: null,
    rawTags: item.rawTags ?? {},
    scrapedAt: now,
    lastUpdatedAt: now,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const log = (msg) => console.log(msg);

  log("━━ OSM Overpass (wide) ━━");
  let osmElements = [];
  try {
    osmElements = await scrapeOsmWide();
    log(`  ${osmElements.length} elements from Overpass`);
  } catch (err) {
    log(`  Overpass FAILED: ${err.message}`);
  }
  const osmCandidates = osmElements.map(normaliseOsmElement).filter(Boolean);
  log(`  ${osmCandidates.length} named entities`);

  log("\n━━ Nominatim search ━━");
  let nomCandidates = [];
  try {
    nomCandidates = await scrapeNominatim({ onLog: log });
    log(`  ${nomCandidates.length} results across all queries`);
  } catch (err) {
    log(`  Nominatim FAILED: ${err.message}`);
  }

  log("\n━━ Justdial ━━");
  let jdCandidates = [];
  try {
    jdCandidates = await scrapeJustdial({ onLog: log });
    log(`  ${jdCandidates.length} entries`);
  } catch (err) {
    log(`  Justdial FAILED: ${err.message}`);
  }

  const allCandidates = [...osmCandidates, ...nomCandidates, ...jdCandidates];
  log(`\n━━ Dedup (${allCandidates.length} raw candidates) ━━`);
  const merged = dedupe(allCandidates, log);

  // Save raw too (for debugging)
  await writeFile(
    RAW_PATH,
    JSON.stringify({ osm: osmCandidates, nominatim: nomCandidates, justdial: jdCandidates }, null, 2),
  );

  const now = new Date().toISOString();
  const mechanics = merged.map((m) => buildMechanic(m, now));

  await writeFile(OUT_PATH, JSON.stringify(mechanics, null, 2));
  log(`\n✓ wrote ${mechanics.length} mechanics → ${OUT_PATH}`);
  log(`✓ wrote raw per-source data → ${RAW_PATH}`);
  log(`\nNext: run \`node tools/scrape-mechanics/enrich.mjs\` to add area names.`);
}

main().catch((err) => {
  console.error("aggregate failed:", err);
  process.exit(1);
});
