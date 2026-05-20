"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Wallet, AlertCircle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { useGarageAuth } from "@/lib/store/auth";
import { useGarageJobs } from "@/lib/store/jobs";
import { MOCK_GARAGE } from "@/lib/mock/garage";
import { rupees } from "@/lib/utils";
import { StatusPill } from "@/components/jobs/StatusPill";

/**
 * /earnings — totals + commission balance.
 *
 * Per V0 design: garages settle commission on cash bookings WEEKLY via UPI.
 * Q8 = b: enforcement is manual in V0; we surface the balance loud + clear.
 */
export default function EarningsPage() {
  const router = useRouter();
  const { isAuthed, hydrated: authHydrated } = useGarageAuth();
  const { jobs, hydrated, completed } = useGarageJobs();

  useEffect(() => {
    if (authHydrated && !isAuthed) router.replace("/login");
  }, [authHydrated, isAuthed, router]);

  if (!authHydrated || !isAuthed || !hydrated) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1" />
        <TabBar />
      </div>
    );
  }

  /* Mock totals — sum from completed jobs in current session, plus baseline. */
  const sessionEarnings = completed.reduce(
    (acc, j) => acc + (j.total - j.commissionCut),
    0,
  );
  const totalEarnings = MOCK_GARAGE.earningsLast30Days + sessionEarnings;

  const cashCompleted = completed.filter((j) => j.paymentMode === "cash");
  const sessionUnpaidCommission = cashCompleted.reduce(
    (acc, j) => acc + j.commissionCut,
    0,
  );
  const totalCommissionDue = MOCK_GARAGE.commissionBalance + sessionUnpaidCommission;

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
              {rupees(totalEarnings)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              After Mister Waan fee. Lifetime: {rupees(MOCK_GARAGE.earningsLifetime + sessionEarnings)}
            </p>
          </section>

          {/* Commission balance */}
          <section
            className={`mt-4 rounded-lg border p-5 shadow-sm ${
              totalCommissionDue > 2000
                ? "border-ignite-200 bg-ignite-50"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-4" strokeWidth={2.25} />
              Commission you owe
            </div>
            <p className="mt-2 tabular text-2xl font-bold text-foreground">
              {rupees(totalCommissionDue)}
            </p>
            {totalCommissionDue > 2000 ? (
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
                No completed jobs yet this session.
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
                        {j.summary}
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
                        +{rupees(j.total - j.commissionCut)}
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

          <p className="mt-8 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <span className="font-semibold">Mock V0:</span> session-only totals. Live data
            arrives once backend wires up. Reset jobs from Profile → Reset demo data.
          </p>
          <span className="sr-only">{jobs.length}</span>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
