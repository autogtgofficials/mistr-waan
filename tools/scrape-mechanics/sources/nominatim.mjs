// Nominatim text search — runs a list of keyword queries scoped to a
// viewbox around Srinagar. Returns up to 50 results per query, rate-limited
// to 1 req/sec.

const UA = "autogtg-scraper/0.1 (contact: farhansyedain@gmail.com)";

// viewbox: lon_min, lat_max, lon_max, lat_min  (Nominatim's order)
const VIEWBOX = "74.55,34.30,75.10,33.92";

const QUERIES = [
  "car repair Srinagar",
  "car mechanic Srinagar",
  "auto repair Srinagar",
  "automobile workshop Srinagar",
  "auto workshop Srinagar",
  "car service Srinagar",
  "car wash Srinagar",
  "denting painting Srinagar",
  "car detailing Srinagar",
  "tyre shop Srinagar",
  "tyre works Srinagar",
  "spare parts Srinagar",
  "motors Srinagar",
  "service station Srinagar",
  "garage Srinagar",
  "puncture repair Srinagar",
  "wheel alignment Srinagar",
  "Kashmir motors",
  "auto Kashmir",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchOnce(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "50");
  url.searchParams.set("viewbox", VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("accept-language", "en");
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${query}"`);
  return res.json();
}

export async function scrapeNominatim({ onLog } = {}) {
  const out = [];
  for (const q of QUERIES) {
    try {
      const results = await searchOnce(q);
      onLog?.(`  "${q}" → ${results.length}`);
      for (const r of results) {
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        out.push({
          id: `nom-${r.place_id}`,
          source: "nominatim_search",
          sourceId: `place/${r.place_id}`,
          name: r.name || r.display_name?.split(",")[0] || "Unnamed",
          phones: [],
          website: null,
          address: r.display_name ?? null,
          lat,
          lng,
          rawTags: {
            class: r.class,
            type: r.type,
            ...r.address,
          },
          nominatimQuery: q,
          nominatimType: `${r.class}/${r.type}`,
        });
      }
      await sleep(1100);
    } catch (err) {
      onLog?.(`  "${q}" → ERROR ${err.message}`);
      await sleep(1100);
    }
  }
  return out;
}
