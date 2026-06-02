#!/usr/bin/env node
// Scrape mechanics / garages in Srinagar from OpenStreetMap (Overpass API).
// Run:  node tools/scrape-mechanics/scrape.mjs
// Output: tools/scrape-mechanics/data/srinagar.json (normalised),
//         tools/scrape-mechanics/data/raw.json     (untouched Overpass body)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferArea } from "./areas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "data");

// Srinagar bounding box: south, west, north, east
const BBOX = [33.96, 74.70, 34.18, 74.93];

// Pick endpoints in order — fall through on failure.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

const QUERY = `
[out:json][timeout:90];
(
  nwr["amenity"="car_repair"](${BBOX.join(",")});
  nwr["shop"="car_repair"](${BBOX.join(",")});
  nwr["shop"="tyres"](${BBOX.join(",")});
  nwr["shop"="car_parts"](${BBOX.join(",")});
  nwr["shop"="car"](${BBOX.join(",")});
  nwr["amenity"="car_wash"](${BBOX.join(",")});
  nwr["service:vehicle:body_repair"](${BBOX.join(",")});
  nwr["service:vehicle:painting"](${BBOX.join(",")});
  nwr["service:vehicle:tyres"](${BBOX.join(",")});
  nwr["service:vehicle:car_wash"](${BBOX.join(",")});
  nwr["service:vehicle:dent_removal"](${BBOX.join(",")});
);
out center tags;
`.trim();

const UA = "autogtg-scraper/0.1 (contact: farhansyedain@gmail.com)";

async function fetchOverpass() {
  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    // Try POST first, then GET — different mirrors prefer different verbs.
    for (const method of ["POST", "GET"]) {
      try {
        console.log(`→ ${method} ${endpoint}`);
        const url = method === "GET"
          ? `${endpoint}?data=${encodeURIComponent(QUERY)}`
          : endpoint;
        const init = {
          method,
          headers: {
            "User-Agent": UA,
            "Accept": "application/json",
            ...(method === "POST"
              ? { "Content-Type": "application/x-www-form-urlencoded" }
              : {}),
          },
          ...(method === "POST"
            ? { body: new URLSearchParams({ data: QUERY }) }
            : {}),
        };
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn(`  failed: ${err.message}`);
        lastErr = err;
      }
    }
  }
  throw lastErr ?? new Error("all Overpass endpoints failed");
}

function buildAddress(tags) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:neighbourhood"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return tags["addr:full"] ?? null;
}

function extractPhones(tags) {
  const fields = [tags.phone, tags["contact:phone"], tags["contact:mobile"], tags.mobile];
  const set = new Set();
  for (const f of fields) {
    if (!f) continue;
    for (const raw of String(f).split(/[;,]/)) {
      const trimmed = raw.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set];
}

const SERVICE_KEYWORDS = [
  { match: /detail|polish|ceramic|foam/i, service: "detailing" },
  { match: /dent|paint|body shop|denting/i, service: "denting" },
  { match: /tyre|tire|puncture|wheel align/i, service: "tyres" },
  { match: /spare|part/i, service: "parts" },
  { match: /wash/i, service: "car_wash" },
  { match: /service center|service centre|garage|workshop|motors|automobile|auto/i, service: "repair" },
];

function inferServices(tags) {
  const out = new Set();
  if (tags.amenity === "car_repair") out.add("repair");
  if (tags.shop === "car_repair") out.add("repair");
  if (tags.shop === "tyres") out.add("tyres");
  if (tags.shop === "car_parts") out.add("parts");
  if (tags.shop === "car") out.add("dealer");
  if (tags.amenity === "car_wash") out.add("car_wash");
  if (tags["service:vehicle:body_repair"] === "yes") out.add("denting");
  if (tags["service:vehicle:painting"] === "yes") out.add("denting");
  if (tags["service:vehicle:tyres"] === "yes") out.add("tyres");
  if (tags["service:vehicle:car_wash"] === "yes") out.add("car_wash");
  if (tags["service:vehicle:dent_removal"] === "yes") out.add("denting");

  const text = [tags.name, tags.description, tags.brand, tags["name:en"]].filter(Boolean).join(" ");
  for (const { match, service } of SERVICE_KEYWORDS) {
    if (match.test(text)) out.add(service);
  }
  if (out.size === 0) out.add("unknown");
  return [...out];
}

function normalise(el, scrapedAt) {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const name = tags.name ?? tags["name:en"] ?? tags.brand ?? "Unnamed mechanic";
  const address = buildAddress(tags);
  const area = inferArea(name, address, tags["addr:suburb"], tags["addr:neighbourhood"]);

  return {
    id: `osm-${el.type}-${el.id}`,
    source: "overpass",
    sourceId: `${el.type}/${el.id}`,
    osmType: el.type,
    name,
    shopName: tags.brand ?? null,
    phones: extractPhones(tags),
    email: tags.email ?? tags["contact:email"] ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    address,
    area,
    lat,
    lng,
    services: inferServices(tags),
    openingHours: tags.opening_hours ?? null,
    rating: null,
    reviewCount: null,
    onboardingStatus: "not_contacted",
    notes: null,
    rawTags: tags,
    scrapedAt,
    lastUpdatedAt: scrapedAt,
  };
}

function summarise(mechanics) {
  const byArea = {};
  const byService = {};
  let withPhone = 0;
  let withArea = 0;
  for (const m of mechanics) {
    const a = m.area ?? "(unknown area)";
    byArea[a] = (byArea[a] ?? 0) + 1;
    for (const s of m.services) byService[s] = (byService[s] ?? 0) + 1;
    if (m.phones.length) withPhone++;
    if (m.area) withArea++;
  }
  return { total: mechanics.length, withPhone, withArea, byArea, byService };
}

function printSummary(s) {
  console.log("");
  console.log(`Total mechanics: ${s.total}`);
  console.log(`  with phone:    ${s.withPhone}`);
  console.log(`  with area:     ${s.withArea}`);
  console.log("");
  console.log("By area:");
  Object.entries(s.byArea)
    .sort((a, b) => b[1] - a[1])
    .forEach(([area, count]) => {
      console.log(`  ${String(count).padStart(3)}  ${area}`);
    });
  console.log("");
  console.log("By service tag:");
  Object.entries(s.byService)
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${String(c).padStart(3)}  ${s}`));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const raw = await fetchOverpass();
  const rawPath = join(OUT_DIR, "raw.json");
  await writeFile(rawPath, JSON.stringify(raw, null, 2));
  console.log(`✓ wrote raw response → ${rawPath} (${raw.elements?.length ?? 0} elements)`);

  const scrapedAt = new Date().toISOString();
  const mechanics = (raw.elements ?? [])
    .map((el) => normalise(el, scrapedAt))
    .filter(Boolean);

  const outPath = join(OUT_DIR, "srinagar.json");
  await writeFile(outPath, JSON.stringify(mechanics, null, 2));
  console.log(`✓ wrote normalised data → ${outPath} (${mechanics.length} mechanics)`);

  printSummary(summarise(mechanics));
}

main().catch((err) => {
  console.error("scrape failed:", err);
  process.exit(1);
});
