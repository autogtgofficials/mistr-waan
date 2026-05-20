#!/usr/bin/env node
// Enrich tools/scrape-mechanics/data/srinagar.json with reverse-geocoded
// addresses (suburb / neighbourhood / road) so we can map each mechanic to a
// known Srinagar locality. Uses Nominatim (OSM, free, no key).
//
// Run:  node tools/scrape-mechanics/enrich.mjs
//
// Caches every reverse-geocode response so re-runs are instant — only new or
// uncached coordinates hit the network.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { inferArea } from "./areas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const SRINAGAR_PATH = join(DATA_DIR, "srinagar.json");
const CACHE_PATH = join(DATA_DIR, "geocode-cache.json");

const UA = "mister-waan-scraper/0.1 (contact: farhansyedain@gmail.com)";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const MIN_DELAY_MS = 1100; // Nominatim policy: max 1 req/sec

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, "utf8"));
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM}?lat=${lat}&lon=${lng}&format=jsonv2&zoom=17&addressdetails=1&accept-language=en`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} ${res.statusText}`);
  return await res.json();
}

function pickArea(geo, name) {
  const addr = geo?.address ?? {};
  // Prefer Srinagar's known locality first via our dictionary; fall back to
  // whichever Nominatim field is most specific.
  const candidates = [
    addr.neighbourhood,
    addr.suburb,
    addr.city_district,
    addr.quarter,
    addr.residential,
    addr.village,
    addr.town,
    addr.road,
    geo?.display_name,
    name,
  ];
  const matched = inferArea(...candidates);
  if (matched) return { area: matched, source: "dictionary" };
  const raw = addr.neighbourhood ?? addr.suburb ?? addr.city_district ?? addr.quarter ?? addr.village ?? addr.town;
  return raw ? { area: raw, source: "nominatim" } : { area: null, source: null };
}

function buildAddressFromGeo(geo) {
  const a = geo?.address ?? {};
  const parts = [
    a.house_number,
    a.road,
    a.neighbourhood,
    a.suburb,
    a.city_district,
    a.city ?? a.town ?? a.village,
    a.postcode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : geo?.display_name ?? null;
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const mechanics = await loadJson(SRINAGAR_PATH, null);
  if (!mechanics) {
    console.error(`No data at ${SRINAGAR_PATH}. Run scrape.mjs first.`);
    process.exit(1);
  }
  const cache = await loadJson(CACHE_PATH, {});

  console.log(`Loaded ${mechanics.length} mechanics. Cached lookups: ${Object.keys(cache).length}.`);

  let hits = 0, misses = 0, failures = 0;
  for (const m of mechanics) {
    const key = `${m.lat.toFixed(5)},${m.lng.toFixed(5)}`;
    if (!cache[key]) {
      try {
        cache[key] = await reverseGeocode(m.lat, m.lng);
        misses++;
        // Persist after each successful call so a Ctrl-C doesn't lose work.
        await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
        process.stdout.write(`.`);
        await sleep(MIN_DELAY_MS);
      } catch (err) {
        failures++;
        cache[key] = { error: err.message };
        process.stdout.write(`x`);
        await sleep(MIN_DELAY_MS);
        continue;
      }
    } else {
      hits++;
    }
    const geo = cache[key];
    if (geo && !geo.error) {
      const { area, source: areaSource } = pickArea(geo, m.name);
      m.area = area;
      m.areaSource = areaSource;
      m.address = m.address ?? buildAddressFromGeo(geo);
      m.reverseGeocode = {
        displayName: geo.display_name,
        neighbourhood: geo.address?.neighbourhood ?? null,
        suburb: geo.address?.suburb ?? null,
        cityDistrict: geo.address?.city_district ?? null,
        road: geo.address?.road ?? null,
        postcode: geo.address?.postcode ?? null,
      };
    }
  }
  console.log("");

  await writeFile(SRINAGAR_PATH, JSON.stringify(mechanics, null, 2));
  console.log(`✓ updated ${SRINAGAR_PATH}`);
  console.log(`  cache hits:  ${hits}`);
  console.log(`  fresh calls: ${misses}`);
  console.log(`  failures:    ${failures}`);

  // Summary
  const byArea = {};
  for (const m of mechanics) {
    const a = m.area ?? "(unknown)";
    byArea[a] = (byArea[a] ?? 0) + 1;
  }
  console.log("\nBy area:");
  Object.entries(byArea)
    .sort((a, b) => b[1] - a[1])
    .forEach(([a, c]) => console.log(`  ${String(c).padStart(3)}  ${a}`));
}

main().catch((err) => {
  console.error("enrich failed:", err);
  process.exit(1);
});
