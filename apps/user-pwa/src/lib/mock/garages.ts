/**
 * Mock garages — V0 placeholder. Real garages come from Ubaid's onboarding pipeline.
 *
 * Note (anti-sideline): in pre-booking surfaces we ONLY expose owner first
 * name + last initial, area (locality), distance, rating, jobs done. Shop
 * name and street address live on the model but are revealed only on the
 * post-booking confirmation screen.
 */

import type { ServiceBucket } from "./services";

export interface Garage {
  id: string;

  /** Owner's first name (e.g. "Imran"). Pre-booking surfaces show "Imran K.". */
  ownerFirstName: string;
  ownerLastName: string;

  /** Shop name — HIDDEN pre-booking. */
  shopName: string;

  /** Free-text locality area (e.g. "Hyderpora area"). Pre-booking surfaces use this. */
  area: string;

  /** Full street address — HIDDEN pre-booking, revealed at confirmation. */
  fullAddress: string;

  /** Approximate distance in km from a fixed mock user location. */
  distanceKm: number;

  /** 1.0 to 5.0, one decimal place. */
  rating: number;

  /** Total completed jobs. New garages may have 0 — we render "New" badge instead. */
  jobsCompleted: number;

  /** Service buckets this garage is approved for. */
  serviceBuckets: ServiceBucket[];

  /** Earliest available slot label (mock — replace with real availability lookup later). */
  earliestSlot: string;
}

export const mockGarages: Garage[] = [
  {
    id: "g-imran-k",
    ownerFirstName: "Imran",
    ownerLastName: "Khan",
    shopName: "Khan Auto Detailing",
    area: "Hyderpora area",
    fullAddress: "Plot 14, Hyderpora Bypass, Srinagar — 190014",
    distanceKm: 3,
    rating: 4.8,
    jobsCompleted: 52,
    serviceBuckets: ["detailing", "repairs"],
    earliestSlot: "Today 4 PM",
  },
  {
    id: "g-faisal-m",
    ownerFirstName: "Faisal",
    ownerLastName: "Mir",
    shopName: "Mir Motors",
    area: "Lal Chowk area",
    fullAddress: "Shop 8, Residency Road, Lal Chowk, Srinagar — 190001",
    distanceKm: 5,
    rating: 4.6,
    jobsCompleted: 31,
    serviceBuckets: ["detailing", "repairs", "denting"],
    earliestSlot: "Today 6 PM",
  },
  {
    id: "g-bilal-a",
    ownerFirstName: "Bilal",
    ownerLastName: "Ahmad",
    shopName: "Bemina Body Works",
    area: "Bemina area",
    fullAddress: "Industrial Estate Road, Bemina, Srinagar — 190018",
    distanceKm: 6,
    rating: 4.4,
    jobsCompleted: 0,
    serviceBuckets: ["denting", "detailing"],
    earliestSlot: "Tomorrow 10 AM",
  },
  {
    id: "g-aamir-s",
    ownerFirstName: "Aamir",
    ownerLastName: "Shah",
    shopName: "Shah Garage",
    area: "Rambagh area",
    fullAddress: "Near Rambagh Bridge, Srinagar — 190008",
    distanceKm: 4,
    rating: 4.7,
    jobsCompleted: 88,
    serviceBuckets: ["repairs", "detailing"],
    earliestSlot: "Today 5 PM",
  },
  {
    id: "g-rashid-b",
    ownerFirstName: "Rashid",
    ownerLastName: "Bhat",
    shopName: "Bhat Auto Care",
    area: "Sanatnagar area",
    fullAddress: "Industrial Area, Sanatnagar, Srinagar — 190005",
    distanceKm: 7,
    rating: 4.5,
    jobsCompleted: 24,
    serviceBuckets: ["repairs", "denting"],
    earliestSlot: "Tomorrow 9 AM",
  },
];

export function getGaragesForBucket(bucket: ServiceBucket): Garage[] {
  return mockGarages.filter((g) => g.serviceBuckets.includes(bucket));
}

export function getGarageById(id: string): Garage | undefined {
  return mockGarages.find((g) => g.id === id);
}
