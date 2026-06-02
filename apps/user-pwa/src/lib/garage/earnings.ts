import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Aggregated earnings for a garage, computed from completed bookings.
 *
 * Net = total − commission (commission = total × garage.commission_pct).
 * `commissionDue` is what the garage owes us on CASH jobs (UPI is netted out
 * by us, so nothing is owed there). Mirrors the per-job math in jobs.ts.
 */
export interface GarageEarnings {
  last30Net: number;
  lifetimeNet: number;
  commissionDue: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getGarageEarnings(garageId: string): Promise<GarageEarnings> {
  const supabase = getSupabaseAdmin();

  const { data: garage } = await supabase
    .from("garages")
    .select("commission_pct")
    .eq("id", garageId)
    .maybeSingle();
  const pct = Number(garage?.commission_pct ?? 12) / 100;

  const { data: rows, error } = await supabase
    .from("bookings")
    .select("total, payment_mode, completed_at")
    .eq("garage_id", garageId)
    .eq("status", "completed");
  if (error) throw new Error(`garage earnings failed: ${error.message}`);

  const cutoff = Date.now() - THIRTY_DAYS_MS;
  let last30Net = 0;
  let lifetimeNet = 0;
  let commissionDue = 0;

  for (const r of rows ?? []) {
    const total = r.total ?? 0;
    const commission = Math.round(total * pct);
    const net = total - commission;
    lifetimeNet += net;
    if (r.completed_at && new Date(r.completed_at).getTime() >= cutoff) {
      last30Net += net;
    }
    if (r.payment_mode === "cash") commissionDue += commission;
  }

  return { last30Net, lifetimeNet, commissionDue };
}
