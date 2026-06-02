import type { BookingBucket } from "@/lib/store/booking-draft";

/**
 * AutoGTG service catalog — sourced directly from the Garage Partner Rate Card.
 *
 * These are the concrete things a customer can pick ("what's wrong"). Prices are
 * intentionally omitted: this is the call-back model, so ops confirms the price
 * on the phone. We keep this as static data (no DB round-trip) so the picker is
 * instant and works offline; the booking carries the picked names through to ops.
 */

export type ServiceCategoryId = "repairs" | "denting" | "detailing" | "cosmetic";

export interface CatalogService {
  /** Stable slug id, e.g. "ac-compressor-repair". */
  id: string;
  name: string;
  category: ServiceCategoryId;
}

export interface ServiceCategory {
  id: ServiceCategoryId;
  label: string;
  blurb: string;
  services: CatalogService[];
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()/]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function build(
  id: ServiceCategoryId,
  label: string,
  blurb: string,
  names: string[],
): ServiceCategory {
  return {
    id,
    label,
    blurb,
    services: names.map((name) => ({ id: slug(name), name, category: id })),
  };
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  build("repairs", "Repairs", "Mechanical & functional fixes", [
    "Engine repair / overhaul",
    "Clutch replacement",
    "Gearbox repair",
    "Brake pad replacement",
    "Brake disc replacement",
    "Suspension repair",
    "Steering repair",
    "Wiring repair",
    "ECU diagnostics",
    "Radiator repair",
    "AC compressor repair",
    "Battery replacement",
    "Fuel pump replacement",
    "Exhaust repair",
  ]),
  build("denting", "Denting & Painting", "Dents, scratches & bodywork", [
    "Minor dent removal",
    "Major dent repair",
    "Paintless dent repair (PDR)",
    "Full body repaint",
    "Panel repaint",
    "Bumper repaint",
    "Accident body restoration",
    "Panel replacement",
    "Rust removal",
    "Anti-rust coating",
  ]),
  build("detailing", "Detailing", "Cleaning, polish & protection", [
    "Foam wash",
    "Machine polishing",
    "Waxing",
    "Ceramic coating",
    "PPF installation",
    "Interior deep cleaning",
    "Seat shampooing",
    "Engine bay cleaning",
    "Underbody coating",
  ]),
  build("cosmetic", "Cosmetic & Modification", "Upgrades & custom touches", [
    "Alloy wheel installation",
    "Body kit installation",
    "Vehicle wrapping",
    "LED headlight upgrade",
    "Ambient lighting installation",
    "Seat cover installation",
    "Sound system upgrade",
    "Exhaust upgrade",
  ]),
];

/** Flat list of every service, for id lookups. */
export const ALL_SERVICES: CatalogService[] = SERVICE_CATEGORIES.flatMap(
  (c) => c.services,
);

const BY_ID = new Map(ALL_SERVICES.map((s) => [s.id, s] as const));

export function getServiceById(id: string): CatalogService | undefined {
  return BY_ID.get(id);
}

export function serviceNames(ids: string[]): string[] {
  return ids
    .map((id) => BY_ID.get(id)?.name)
    .filter((n): n is string => Boolean(n));
}

/**
 * Popular services surfaced as quick-pick tiles on the home screen.
 * A spread across categories so the most common intents are one tap away.
 */
export const FEATURED_SERVICE_IDS: string[] = [
  "ac-compressor-repair",
  "brake-pad-replacement",
  "battery-replacement",
  "foam-wash",
  "minor-dent-removal",
];

export const FEATURED_SERVICES: CatalogService[] = FEATURED_SERVICE_IDS.map(
  (id) => BY_ID.get(id),
).filter((s): s is CatalogService => Boolean(s));

/**
 * The booking_bucket enum only has detailing/repairs/denting. Cosmetic work maps
 * to detailing for storage; ops sees the exact service names regardless.
 */
const CATEGORY_TO_BUCKET: Record<ServiceCategoryId, BookingBucket> = {
  repairs: "repairs",
  denting: "denting",
  detailing: "detailing",
  cosmetic: "detailing",
};

export function bucketForCategory(category: ServiceCategoryId): BookingBucket {
  return CATEGORY_TO_BUCKET[category];
}

/** Pick a representative bucket for a set of picked service ids. */
export function bucketForServices(ids: string[]): BookingBucket {
  const first = ids.map((id) => BY_ID.get(id)).find(Boolean);
  return first ? bucketForCategory(first.category) : "repairs";
}
