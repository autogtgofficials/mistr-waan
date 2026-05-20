"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useJobs } from "@/lib/store/jobs";
import { useAuth } from "@/lib/store/auth";
import { getGarageById } from "@/lib/mock/garages";
import { detailingServices } from "@/lib/mock/services";
import { ownerLabel, rupees } from "@/lib/utils";
import { StatusPill } from "@/components/booking/StatusPill";

/**
 * RecentJobs — Home screen section shown only to signed-in users with
 * at least one job in history. Tap a card → live tracking screen.
 */
export function RecentJobs() {
  const { jobs, hydrated } = useJobs();
  const { isAuthed, hydrated: authHydrated } = useAuth();

  if (!hydrated || !authHydrated || !isAuthed) return null;
  if (jobs.length === 0) return null;

  const recent = [...jobs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Recent bookings</h2>
        <Link
          href="/bookings"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          See all →
        </Link>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {recent.map((job) => {
          const garage = getGarageById(job.garageId);
          const labelService =
            job.serviceIds.length > 0
              ? detailingServices.find((s) => s.id === job.serviceIds[0])?.name ??
                job.bucket
              : job.bucket;
          return (
            <li key={job.id}>
              <Link
                href={`/bookings/${job.id}`}
                className="tap block rounded-md border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-foreground capitalize">
                      {labelService}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      With{" "}
                      {garage
                        ? ownerLabel(garage.ownerFirstName, garage.ownerLastName)
                        : "—"}
                    </span>
                  </div>
                  <StatusPill status={job.status} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  {job.rating ? (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={
                            n <= job.rating!
                              ? "size-4 fill-ignite-500 text-ignite-500"
                              : "size-4 text-steel-300"
                          }
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {job.paymentMode === "upi"
                        ? `Paid ${rupees(job.total)}`
                        : `${rupees(job.total)} cash`}
                    </span>
                  )}
                  <span className="text-sm text-primary font-medium">View →</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
