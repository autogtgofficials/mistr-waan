"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/booking/StatusPill";
import { useJobs } from "@/lib/store/jobs";
import { useAuth } from "@/lib/store/auth";
import { ownerLabel, rupees, timeAgo } from "@/lib/utils";

/**
 * /bookings — list of all the user's bookings (active + history).
 *
 * Logged-out users see a sign-in prompt instead.
 */
export default function BookingsPage() {
  const { jobs, hydrated } = useJobs();
  const { isAuthed, hydrated: authHydrated } = useAuth();

  if (!hydrated || !authHydrated) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1" />
        <TabBar />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex flex-1 items-center justify-center px-4">
          <EmptyState
            icon={ClipboardList}
            title="Sign in to see your bookings"
            body="We'll show your active and past bookings here."
            action={
              <Link
                href="/login?next=/bookings"
                className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            }
          />
        </main>
        <TabBar />
      </div>
    );
  }

  const sorted = [...jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <ActiveJobBar />
      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">Your bookings</h1>

          {sorted.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No bookings yet"
              body="Book your first service from the home tab."
              action={
                <Link
                  href="/"
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Go to home →
                </Link>
              }
              className="mt-6"
            />
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {sorted.map((job) => {
                const garage = job.garage ?? null;
                const days = Math.max(
                  0,
                  Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000),
                );
                const amount = job.total ?? job.baseTotal ?? 0;
                return (
                  <li key={job.id}>
                    <Link
                      href={`/bookings/${job.shortId}`}
                      className="tap block rounded-md border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-base font-semibold text-foreground">
                            {garage
                              ? ownerLabel(garage.ownerFirstName, garage.ownerLastName)
                              : "Finding garage…"}
                          </span>
                          <span className="text-sm text-muted-foreground capitalize">
                            {job.bucket} · {job.slotLabel}
                          </span>
                        </div>
                        <StatusPill status={job.status} />
                      </div>

                      <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {job.paymentMode === "upi"
                            ? amount > 0
                              ? `Paid ${rupees(amount)} via UPI`
                              : "UPI"
                            : amount > 0
                              ? `${rupees(amount)} cash on completion`
                              : "Cash on completion"}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(days)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <TabBar />
    </div>
  );
}
