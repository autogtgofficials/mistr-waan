"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Wallet, AlertCircle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { useGarageAuth } from "@/lib/store/auth";
import { useGarageJobs } from "@/lib/store/jobs";
import { api } from "@/lib/api/client";
import type { GarageEarnings } from "@/lib/api/types";
import { rupees } from "@/lib/utils";
import { StatusPill } from "@/components/jobs/StatusPill";

/**
 * /earnings — real net earnings + commission owed, from /api/garage/earnings.
 *
 * Garages settle commission on cash bookings weekly via UPI; we surface the
 * balance loud + clear. The recent-payouts list comes from the live jobs feed.
 */
export default function EarningsPage() {
  const router = useRouter();
  const { isAuthed, hydrated: authHydrated } = useGarageAuth();
  const { hydrated, completed } = useGarageJobs();
  const [earnings, setEarnings] = useState<GarageEarnings | null>(null);

  useEffect(() => {
    if (authHydrated && !isAuthed) router.replace("/login");
  }, [authHydrated, isAuthed, router]);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<{ earnings: GarageEarnings }>(
          "/api/garage/earnings",
        );
        if (!cancelled) setEarnings(data.earnings);
      } catch {
        // Leave nulls — totals render as ₹0 until the next refresh.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  if (!authHydrated || !isAuthed || !hydrated) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1" />
        <TabBar />
      </div>
    );
  }

  const last30 = earnings?.last30Net ?? 0;
  const lifetime = earnings?.lifetimeNet ?? 0;
  const commissionDue = earnings?.commissionDue ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />

      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">Earnings</h1>

          {/* Earnings card */}
          <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="size-4" strokeWidth={2.25} />
              Last 30 days
            </div>
            <p className="mt-2 tabular text-4xl font-bold text-foreground">
              {rupees(last30)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              After AutoGTG fee. Lifetime: {rupees(lifetime)}
            </p>
          </section>

          {/* Commission balance */}
          <section
            className={`mt-4 rounded-lg border p-5 shadow-sm ${
              commissionDue > 2000
                ? "border-ignite-200 bg-ignite-50"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-4" strokeWidth={2.25} />
              Commission you owe
            </div>
            <p className="mt-2 tabular text-2xl font-bold text-foreground">
              {rupees(commissionDue)}
            </p>
            {commissionDue > 2000 ? (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-card p-3">
                <AlertCircle className="size-4 shrink-0 text-ignite-700" strokeWidth={2} />
                <p className="text-xs text-ignite-900">
                  Please settle by Sunday so we can keep sending you new jobs.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Settle weekly via UPI to <span className="font-semibold">+91 80000 11122</span>.
              </p>
            )}
          </section>

          {/* Recent payouts list */}
          <section className="mt-8">
            <h2 className="text-base font-semibold text-foreground">Recent payouts</h2>
            {completed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No completed jobs yet.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {completed.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {j.services?.[0]?.name ?? j.bucket}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {j.customerLabel} · {j.slotLabel}
                      </span>
                      <span className="mt-1">
                        <StatusPill status={j.status} />
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-semibold text-foreground">
                        +{rupees((j.total ?? 0) - (j.commissionCut ?? 0))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {j.paymentMode === "upi" ? "UPI · payout pending" : "Cash"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
