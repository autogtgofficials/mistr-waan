// Shape of one mechanic in data/mechanics.json (produced by
// tools/scrape-mechanics/scrape.mjs + enrich.mjs).

export type ServiceTag =
  | "repair"
  | "detailing"
  | "denting"
  | "tyres"
  | "parts"
  | "car_wash"
  | "dealer"
  | "unknown";

export type OnboardingStatus =
  | "not_contacted"
  | "contacted"
  | "interested"
  | "declined"
  | "onboarded";

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  "not_contacted",
  "contacted",
  "interested",
  "onboarded",
  "declined",
];

export interface ReverseGeocode {
  displayName: string;
  neighbourhood: string | null;
  suburb: string | null;
  cityDistrict: string | null;
  road: string | null;
  postcode: string | null;
}

export interface Mechanic {
  id: string;
  source: "overpass";
  sourceId: string;
  osmType: "node" | "way" | "relation";
  name: string;
  shopName: string | null;
  phones: string[];
  email: string | null;
  website: string | null;
  address: string | null;
  area: string | null;
  areaSource?: "dictionary" | "nominatim";
  lat: number;
  lng: number;
  services: ServiceTag[];
  openingHours: string | null;
  rating: number | null;
  reviewCount: number | null;
  onboardingStatus: OnboardingStatus;
  notes: string | null;
  rawTags: Record<string, string>;
  reverseGeocode?: ReverseGeocode;
  scrapedAt: string;
  lastUpdatedAt: string;
}

/** Just the per-mechanic editable bits stored in data/overrides.json. */
export interface MechanicOverride {
  onboardingStatus?: OnboardingStatus;
  notes?: string | null;
  updatedAt: string;
}
