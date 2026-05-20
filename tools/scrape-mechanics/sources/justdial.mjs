// Justdial scrape — best-effort. Justdial uses anti-bot measures and renders
// some listings via JS, but their core listing HTML often includes the bulk
// of the business cards. We try a small set of category URLs.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const URLS = [
  "https://www.justdial.com/Srinagar/Car-Repair-Services",
  "https://www.justdial.com/Srinagar/Automobile-Repair-Workshop",
  "https://www.justdial.com/Srinagar/Car-Mechanics",
  "https://www.justdial.com/Srinagar/Tyre-Dealers",
  "https://www.justdial.com/Srinagar/Car-Denting-Services",
  "https://www.justdial.com/Srinagar/Car-Washing-Services",
];

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Parse one Justdial listing HTML page. Justdial structure has changed over
 * time; we try a couple of heuristics and grab whatever phone+name we can.
 * If they fully block us, this returns [].
 */
function parsePage(html, sourceUrl) {
  const out = [];
  // Heuristic 1: look for JSON-LD blocks of type LocalBusiness.
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(html))) {
    try {
      const obj = JSON.parse(m[1]);
      const items = Array.isArray(obj) ? obj : [obj];
      for (const it of items) {
        if (!it) continue;
        const arr = Array.isArray(it["@graph"]) ? it["@graph"] : [it];
        for (const node of arr) {
          if (!node) continue;
          const type = node["@type"];
          if (
            !type ||
            (Array.isArray(type) ? !type.some((t) => /Business|Store|Organization/i.test(t)) : !/Business|Store|Organization/i.test(type))
          )
            continue;
          const name = node.name;
          if (!name) continue;
          out.push({
            id: `jd-${name.replace(/\s+/g, "_").toLowerCase()}-${out.length}`,
            source: "justdial",
            sourceId: sourceUrl,
            name,
            phones: typeof node.telephone === "string" ? [node.telephone] : Array.isArray(node.telephone) ? node.telephone : [],
            website: node.url ?? null,
            address:
              typeof node.address === "string"
                ? node.address
                : node.address?.streetAddress
                  ? [
                      node.address.streetAddress,
                      node.address.addressLocality,
                      node.address.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : null,
            lat: Number(node.geo?.latitude) || null,
            lng: Number(node.geo?.longitude) || null,
            rawTags: { jdType: Array.isArray(type) ? type.join(",") : type },
          });
        }
      }
    } catch {
      /* skip malformed JSON-LD */
    }
  }

  // Heuristic 2: regex over visible HTML. Justdial often has data-* attributes
  // for company name + phone on listing cards. Look for patterns like:
  //   <h2 class="..."><a ...>Bhat Motors</a></h2>
  //   <span class="callcontent">0194 247 3033</span>
  if (out.length === 0) {
    const blockRe = /<li[^>]*class="[^"]*resultbox[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let bm;
    while ((bm = blockRe.exec(html))) {
      const block = bm[1];
      const nameMatch = block.match(/<h2[^>]*>[\s\S]*?<(?:a|span)[^>]*>([^<]+)</i);
      const phoneMatch = block.match(/(\+?91[\s\-]?)?(\d{4,5}[\s\-]?\d{5,7})/);
      const addrMatch = block.match(/<span[^>]*class="[^"]*adrs[^"]*"[^>]*>([^<]+)</i);
      const name = nameMatch?.[1]?.trim();
      if (!name) continue;
      out.push({
        id: `jd-${name.replace(/\s+/g, "_").toLowerCase()}-${out.length}`,
        source: "justdial",
        sourceId: sourceUrl,
        name,
        phones: phoneMatch ? [phoneMatch[0].trim()] : [],
        website: null,
        address: addrMatch?.[1]?.trim() ?? null,
        lat: null,
        lng: null,
        rawTags: {},
      });
    }
  }

  return out;
}

export async function scrapeJustdial({ onLog } = {}) {
  const out = [];
  for (const url of URLS) {
    try {
      onLog?.(`→ ${url}`);
      const html = await fetchPage(url);
      const items = parsePage(html, url);
      onLog?.(`   parsed ${items.length} entries`);
      out.push(...items);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      onLog?.(`   FAILED: ${err.message}`);
    }
  }
  return out;
}
