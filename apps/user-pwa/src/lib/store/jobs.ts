"use client";

/**
 * Client-side bookings hook (kept under the legacy `jobs` filename so existing
 * imports keep working — full rename to `bookings.ts` lands after week 1).
 *
 * Reads from `/api/bookings` (GET list) on mount and on `refresh()`.
 * Mutations (cancel, rate) call dedicated endpoints — for week 1 those endpoints
 * don't exist yet, so the optimistic update is gated behind a TODO.
 */

import { useCallback, useEffect, useState } from "react";
import type { Booking, BookingBucket, BookingStatus } from "@/lib/bookings/types";

/** Legacy alias kept for components that imported JobStatus. */
export type JobStatus = BookingStatus;

/** Legacy alias kept for components that imported Job. */
export type Job = Booking;

export function useJobs() {
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings", { credentials: "include" });
      if (!res.ok) {
        setJobs([]);
        return;
      }
      const data = (await res.json()) as { bookings: Booking[] };
      setJobs(data.bookings);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // TODO Week 3: call PATCH /api/bookings/[id]/cancel.
  // For now, optimistic local update so the existing UI still feels responsive.
  const cancel = useCallback((id: string) => {
    setJobs((prev) =>
      prev.map((b) =>
        b.id === id || b.shortId === id ? { ...b, status: "cancelled" } : b,
      ),
    );
  }, []);

  // TODO Week 4: call POST /api/bookings/[id]/rating.
  const update = useCallback((id: string, patch: Partial<Booking>) => {
    setJobs((prev) =>
      prev.map((b) => (b.id === id || b.shortId === id ? { ...b, ...patch } : b)),
    );
  }, []);

  const activeJob = jobs.find(
    (b) =>
      b.status === "queued_for_call" ||
      b.status === "quoted" ||
      b.status === "awaiting_garage" ||
      b.status === "assigned" ||
      b.status === "in_progress",
  );

  return { jobs, hydrated, update, cancel, activeJob, refresh };
}

/** Re-export BookingBucket for legacy consumers. */
export type { BookingBucket };
