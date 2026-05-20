/**
 * Mock service catalog — V0 placeholder.
 * Real prices come from Ubaid's Garage Partner Rate Card (TODO: import once
 * the rate card spreadsheet is structured into JSON).
 */

export type ServiceBucket = "repairs" | "detailing" | "denting";

export interface ServiceItem {
  id: string;
  bucket: ServiceBucket;
  name: string;
  /** Fixed price for catalog flows (Detailing). For Repairs we'd use a price range; not modelled here yet. */
  price: number;
  /** Human-readable duration label. */
  duration: string;
  /** Short description shown in catalog. Optional — only for non-obvious services. */
  blurb?: string;
}

export const detailingServices: ServiceItem[] = [
  {
    id: "foam-wash",
    bucket: "detailing",
    name: "Foam wash",
    price: 500,
    duration: "30 min",
    blurb: "Snow-foam exterior wash with soft-touch dry.",
  },
  {
    id: "machine-polish",
    bucket: "detailing",
    name: "Machine polish",
    price: 2000,
    duration: "1 hr",
    blurb: "Removes minor scratches and brings back the shine.",
  },
  {
    id: "waxing",
    bucket: "detailing",
    name: "Waxing",
    price: 1500,
    duration: "45 min",
  },
  {
    id: "ceramic-coating",
    bucket: "detailing",
    name: "Ceramic coating",
    price: 15000,
    duration: "Full day",
    blurb: "9H glass coating. Lasts 2–3 years with care.",
  },
  {
    id: "interior-deep-clean",
    bucket: "detailing",
    name: "Interior deep clean",
    price: 1500,
    duration: "1 hr",
  },
  {
    id: "seat-shampoo",
    bucket: "detailing",
    name: "Seat shampoo",
    price: 800,
    duration: "30 min",
  },
  {
    id: "engine-bay-clean",
    bucket: "detailing",
    name: "Engine bay clean",
    price: 600,
    duration: "30 min",
  },
  {
    id: "underbody-coat",
    bucket: "detailing",
    name: "Underbody coat",
    price: 2500,
    duration: "1 hr",
    blurb: "Anti-rust coating for the chassis.",
  },
];

/** Lookup by id. */
export function getServiceById(id: string): ServiceItem | undefined {
  return [...detailingServices].find((s) => s.id === id);
}
