/**
 * Domain types served by the user-pwa garage API.
 *
 * We keep these copies (rather than importing from a shared workspace) so
 * the garage PWA can be deployed independently to a different host. The
 * shapes must stay in sync with apps/user-pwa/src/lib/garage/jobs.ts +
 * lib/bookings/types.ts.
 */

export type BookingBucket = "detailing" | "repairs" | "denting";
export type PaymentMode = "cash" | "upi";

export type BookingStatus =
  | "queued_for_call"
  | "quoted"
  | "awaiting_garage"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined_by_garage";

export interface GarageInfo {
  id: string;
  shopName: string;
  ownerFirstName: string;
  ownerLastName: string;
  area: string;
  fullAddress: string;
  rating: number;
  jobsCompleted: number;
  serviceBuckets: string[];
}

/** Aggregated earnings for the logged-in garage (from /api/garage/earnings). */
export interface GarageEarnings {
  /** Net earnings (after AutoGTG fee) in the last 30 days, ₹. */
  last30Net: number;
  /** Net earnings since joining, ₹. */
  lifetimeNet: number;
  /** Commission owed on cash jobs, ₹. */
  commissionDue: number;
}

export interface GarageJob {
  id: string;
  shortId: string;
  bucket: BookingBucket;
  status: BookingStatus;
  slotLabel: string;
  total: number | null;
  baseTotal: number | null;
  paymentMode: PaymentMode;
  customerLabel: string;
  customerArea: string;
  customerPhoneMasked: string;
  commissionCut: number | null;
  services?: { id: string; name: string; basePrice: number; isQuoted: boolean }[];
  symptoms: Record<string, unknown> | null;
  denting: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  inProgressAt: string | null;
  completedAt: string | null;
}
