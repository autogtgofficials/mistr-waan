"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { JobCard } from "@/components/jobs/JobCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useGarageAuth } from "@/lib/store/auth";
import { useGarageJobs } from "@/lib/store/jobs";

/**
 * Garage inbox — three buckets:
 *   • New requests (awaiting_garage) — needs Accept/Decline
 *   • Active (assigned + in_progress) — work the garage is doing
 *   • Recent (completed + cancelled) — last few outcomes
 */
export default function GarageInboxPage() {
  const router = useRouter();
  const { user, hydrated: authHydrated, isAuthed } = useGarageAuth();
  const { hydrated, error, pending, active, completed, cancelled, refresh } = useGarageJobs();

  useEffect(() => {
    if (authHydrated && !isAuthed) router.replace("/login");
  }, [authHydrated, isAuthed, router]);

  if (!authHydrated || !isAuthed) {
    return <div className="flex min-h-full" />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        title={
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">
              {user?.shopName ?? "Garage"}
            </span>
            <span className="text-xs text-muted-foreground">
              {user?.ownerFirstName} · {user?.area}
            </span>
          </div>
        }
        right={
          <button
            onClick={() => void refresh()}
            className="tap rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Refresh
          </button>
        }
      />

      <main className="flex-1 pb-24">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          {!hydrated ? (
            <div className="mt-12 flex justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : error ? (
            <EmptyState title="Couldn't load jobs" body={error} />
          ) : (
            <>
              <Section
                title="New requests"
                empty="No new requests right now."
                jobs={pending}
              />
              <Section
                title="Active"
                empty="No active jobs."
                jobs={active}
              />
              <Section
                title="Recently finished"
                empty="No recent jobs."
                jobs={[...completed, ...cancelled].slice(0, 5)}
              />
            </>
          )}
        </div>
      </main>

      <TabBar />
    </div>
  );
}

function Section({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: ReturnType<typeof useGarageJobs>["pending"];
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {jobs.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id}>
              <JobCard job={j} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
