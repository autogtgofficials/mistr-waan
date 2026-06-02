// Expanded OSM Overpass scrape — wider bbox covering Srinagar Metropolitan
// area (incl. Budgam, Pampore, parts of Ganderbal) plus many more tags than
// the original `scrape.mjs`, including motorcycle shops, craft tags, name
// regex patterns for "motors / garage / service" so we don't rely on OSM
// having a perfect amenity= tag.

const UA = "autogtg-scraper/0.1 (contact: farhansyedain@gmail.com)";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Wider bbox: south, west, north, east — covers Srinagar metro + immediate
// suburbs likely to service Srinagar residents.
const BBOX = [33.92, 74.55, 34.30, 75.10];
const BB = BBOX.join(",");

const QUERY = `
[out:json][timeout:120];
(
  nwr["amenity"="car_repair"](${BB});
  nwr["shop"="car_repair"](${BB});
  nwr["shop"="tyres"](${BB});
  nwr["shop"="car_parts"](${BB});
  nwr["shop"="car"](${BB});
  nwr["shop"="motorcycle"](${BB});
  nwr["shop"="motorcycle_repair"](${BB});
  nwr["amenity"="car_wash"](${BB});
  nwr["amenity"="fuel"]["service:vehicle:car_repair"](${BB});
  nwr["amenity"="fuel"]["car_wash"="yes"](${BB});
  nwr["service:vehicle:body_repair"](${BB});
  nwr["service:vehicle:painting"](${BB});
  nwr["service:vehicle:tyres"](${BB});
  nwr["service:vehicle:car_wash"](${BB});
  nwr["service:vehicle:dent_removal"](${BB});
  nwr["service:vehicle:repair"](${BB});
  nwr["service:vehicle:diagnostics"](${BB});
  nwr["craft"="tyres"](${BB});
  nwr["craft"="metal_construction"]["name"~"auto|motor|garage|service",i](${BB});
  nwr["office"="company"]["name"~"motor|automobile|tyre|garage",i](${BB});
  nwr["name"~"motors|automobile|car wash|tyre|denting|garage|service station|auto",i]["shop"!~"."]["amenity"!~"."](${BB});
);
out center tags;
`.trim();

export async function scrapeOsmWide() {
  let lastErr;
  for (const endpoint of ENDPOINTS) {
    for (const method of ["POST", "GET"]) {
      try {
        const url =
          method === "GET" ? `${endpoint}?data=${encodeURIComponent(QUERY)}` : endpoint;
        const init = {
          method,
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
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
        const json = await res.json();
        return json.elements ?? [];
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr ?? new Error("Overpass failed");
}

export function normaliseOsmElement(el) {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const name = tags.name ?? tags["name:en"] ?? tags.brand ?? null;
  if (!name) return null; // we'd rather skip nameless than poison the list

  const phones = [];
  for (const f of [tags.phone, tags["contact:phone"], tags["contact:mobile"], tags.mobile]) {
    if (!f) continue;
    for (const raw of String(f).split(/[;,]/)) {
      const t = raw.trim();
      if (t) phones.push(t);
    }
  }

  return {
    id: `osm-${el.type}-${el.id}`,
    source: "overpass",
    sourceId: `${el.type}/${el.id}`,
    osmType: el.type,
    name,
    phones,
    website: tags.website ?? tags["contact:website"] ?? null,
    address:
      tags["addr:full"] ??
      ([tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
        .filter(Boolean)
        .join(", ") || null),
    lat,
    lng,
    rawTags: tags,
  };
}
