// Known localities/neighbourhoods of Srinagar (and a few of the immediate
// suburbs we'd reasonably service). Used to infer an `area` field by
// keyword-matching the mechanic's name/address. Order matters slightly —
// longer, more specific names come first so "Sanat Nagar" doesn't get
// shadowed by "Nagar".

export const SRINAGAR_AREAS = [
  // Two-word / specific names first
  "Lal Chowk",
  "Lal Bazar",
  "Karan Nagar",
  "Sanat Nagar",
  "Jawahar Nagar",
  "Indira Nagar",
  "Mehjoor Nagar",
  "Ahmad Nagar",
  "Wazir Bagh",
  "Gulab Bagh",
  "Padshahi Bagh",
  "Chashma Shahi",
  "Habba Kadal",
  "Saida Kadal",
  "Zaina Kadal",
  "Pantha Chowk",
  "Hyderpora Bypass",
  "Bypass Road",
  // Single-token areas
  "Rajbagh",
  "Hyderpora",
  "Bemina",
  "Chanapora",
  "Channapora",
  "Sonwar",
  "Batamaloo",
  "Hawal",
  "Nowhatta",
  "Eidgah",
  "Dalgate",
  "Boulevard",
  "Nishat",
  "Shalimar",
  "Buchpora",
  "Hazratbal",
  "Soura",
  "Khanyar",
  "Maisuma",
  "Nowgam",
  "Tankipora",
  "Barzulla",
  "Natipora",
  "Pampore",
  "Shivpora",
  "Nagin",
  "Anchar",
  "Hokarsar",
  "Khimber",
  "Dachigam",
  "Brain",
  "Harwan",
  "Parimpora",
  "Qamarwari",
  "Zakura",
  "Rambagh",
  "Solina",
  "Bagat",
  "Kralpora",
  "Lasjan",
  "HMT",
];

// Lowercased lookup for case-insensitive matching.
const LOWER = SRINAGAR_AREAS.map((a) => ({ key: a.toLowerCase(), label: a }));

/**
 * Returns the first known area name found inside the given strings, or null.
 * Matches are case-insensitive and prefer the most specific (earliest) entry
 * in SRINAGAR_AREAS.
 */
export function inferArea(...strings) {
  const hay = strings
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
  for (const { key, label } of LOWER) {
    if (hay.includes(key)) return label;
  }
  return null;
}
