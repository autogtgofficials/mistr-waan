/**
 * Mock garage profile (the garage owner using this PWA).
 * V0 demo: hardcoded — "Imran K. of Khan Auto Detailing".
 *
 * When backend joins, this comes from `/me` after JWT auth.
 */

export const MOCK_GARAGE = {
  id: "g-imran-k",
  ownerFirstName: "Imran",
  ownerLastName: "Khan",
  ownerPhone: "+91 60066 17842",
  shopName: "Khan Auto Detailing",
  area: "Hyderpora area",
  fullAddress: "Plot 14, Hyderpora Bypass, Srinagar — 190014",
  rating: 4.8,
  jobsCompleted: 52,
  serviceBuckets: ["detailing", "repairs"] as const,
  /** Cumulative commission (₹) the garage owes AutoGTG from cash bookings. */
  commissionBalance: 1240,
  /** Total earnings in last 30 days (₹). */
  earningsLast30Days: 184500,
  /** Total earnings since joining (₹). */
  earningsLifetime: 612000,
};

export type MockGarage = typeof MOCK_GARAGE;
