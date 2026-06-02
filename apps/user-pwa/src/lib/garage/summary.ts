import type { Garage } from "@/lib/garage/data";

/**
 * Client-safe garage view-model for the customer browse surface.
 *
 * Pre-booking we only expose owner first name + last initial, area, rating,
 * jobs done, the service buckets, and working hours (if known). Shop name,
 * address, and phone stay hidden until a booking is confirmed.
 *
 * (Type-only import of `Garage` from the server-only data layer is erased at
 * compile time, so this module is safe to import into client components.)
 */
export interface GarageSummary {
  id: string;
  ownerFirstName: string;
  ownerLastName: string;
  area: string;
  rating: number;
  jobsCompleted: number;
  serviceBuckets: string[];
  workingHours: string | null;
}

export function toGarageSummary(g: Garage): GarageSummary {
  return {
    id: g.id,
    ownerFirstName: g.ownerFirstName,
    ownerLastName: g.ownerLastName,
    area: g.area,
    rating: g.rating,
    jobsCompleted: g.jobsCompleted,
    serviceBuckets: g.serviceBuckets,
    workingHours: g.workingHours,
  };
}
