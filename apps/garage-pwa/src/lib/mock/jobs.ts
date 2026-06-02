/**
 * Mock jobs from the garage's perspective.
 *
 * Statuses surface differently than user-side:
 *   - pending         — just came in, garage hasn't accepted yet
 *   - assigned        — accepted, scheduled
 *   - in_progress     — garage marked started
 *   - completed       — done, awaiting payout (or cash settlement)
 *   - cancelled       — user cancelled (informational)
 *
 * A "Quote requested" status is also surfaced for denting jobs awaiting
 * the garage's photo-quote response.
 */

export type GarageJobStatus =
  | "pending"
  | "quote_requested"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type GarageJobBucket = "detailing" | "repairs" | "denting";

export interface GarageJob {
  id: string;
  bucket: GarageJobBucket;
  /** What the user picked or asked for. */
  summary: string;
  /** First name + initial of the customer (anonymisation parity with user side). */
  customerLabel: string;
  /** Approximate area of the customer (we never show their exact address). */
  customerArea: string;
  slotLabel: string;
  total: number; // rupees
  /** "upi" = paid in-app, payout pending. "cash" = collect on completion. */
  paymentMode: "upi" | "cash";
  status: GarageJobStatus;
  /** Garage's commission cut at 12% (locked V0 placeholder). */
  commissionCut: number;
  createdAtIso: string;
}

/**
 * Seed of demo jobs — designed to show every status at first run.
 * Mutable in sessionStorage; first-mount initialisation copies these in.
 */
export const SEED_JOBS: GarageJob[] = [
  {
    id: "AG-PNDG01",
    bucket: "repairs",
    summary: "Brake — sounds noisy when braking",
    customerLabel: "Aamir S.",
    customerArea: "Rajbagh",
    slotLabel: "Today 4:00 PM",
    total: 2200,
    paymentMode: "upi",
    status: "pending",
    commissionCut: 264,
    createdAtIso: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: "AG-PNDG02",
    bucket: "detailing",
    summary: "Foam wash + Machine polish",
    customerLabel: "Ovais L.",
    customerArea: "Lal Chowk",
    slotLabel: "Today 6:00 PM",
    total: 2500,
    paymentMode: "upi",
    status: "pending",
    commissionCut: 300,
    createdAtIso: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "AG-QRQ001",
    bucket: "denting",
    summary: "Driver-side dent — 3 photos uploaded",
    customerLabel: "Hilal D.",
    customerArea: "Bemina",
    slotLabel: "—",
    total: 0,
    paymentMode: "upi",
    status: "quote_requested",
    commissionCut: 0,
    createdAtIso: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "AG-ASG001",
    bucket: "detailing",
    summary: "Ceramic coating",
    customerLabel: "Khalid M.",
    customerArea: "Hyderpora",
    slotLabel: "Tomorrow 10:00 AM",
    total: 15000,
    paymentMode: "upi",
    status: "assigned",
    commissionCut: 1800,
    createdAtIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "AG-IPRG01",
    bucket: "repairs",
    summary: "Engine — rough at idle",
    customerLabel: "Tariq W.",
    customerArea: "Chanapora",
    slotLabel: "Today 2:00 PM",
    total: 1800,
    paymentMode: "cash",
    status: "in_progress",
    commissionCut: 216,
    createdAtIso: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: "AG-CMP001",
    bucket: "detailing",
    summary: "Foam wash",
    customerLabel: "Sameer W.",
    customerArea: "Hyderpora",
    slotLabel: "Yesterday",
    total: 500,
    paymentMode: "upi",
    status: "completed",
    commissionCut: 60,
    createdAtIso: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "AG-CMP002",
    bucket: "repairs",
    summary: "Battery replacement",
    customerLabel: "Asif K.",
    customerArea: "Rajbagh",
    slotLabel: "Yesterday",
    total: 5500,
    paymentMode: "cash",
    status: "completed",
    commissionCut: 660,
    createdAtIso: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
  },
];
