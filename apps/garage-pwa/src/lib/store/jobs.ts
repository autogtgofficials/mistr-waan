"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { GarageJob, BookingStatus } from "@/lib/api/types";

/**
 * Garage jobs hook. Polls /api/garage/jobs on mount (and on demand). Realtime
 * subscriptions land in Week 4; until then a manual refresh + post-action
 * refetch keeps the inbox accurate without overwhelming the API.
 */
export function useGarageJobs() {
  const [jobs, setJobs] = useState<GarageJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data = await api.get<{ jobs: GarageJob[] }>("/api/garage/jobs");
      setJobs(data.jobs);
      setError(null);
    } catch (err) {
      console.error("[garage jobs] refresh failed", err);
      setError(err instanceof Error ? err.message : "fetch_failed");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Derived buckets — same shape the inbox UI expects. */
  const pending = jobs.filter((j) => j.status === "awaiting_garage");
  const active = jobs.filter(
    (j) => j.status === "assigned" || j.status === "in_progress",
  );
  const completed = jobs.filter((j) => j.status === "completed");
  const cancelled = jobs.filter(
    (j) => j.status === "cancelled" || j.status === "declined_by_garage",
  );

  return {
    jobs,
    hydrated,
    error,
    pending,
    active,
    completed,
    cancelled,
    refresh,
  };
}

/** Action helpers — return the refreshed job and bubble API errors. */
export const garageActions = {
  async respond(args: {
    bookingId: string;
    outcome: "accept" | "decline";
  }): Promise<{ booking: GarageJob }> {
    return api.post<{ booking: GarageJob }>(
      `/api/garage/jobs/${args.bookingId}/respond`,
      { outcome: args.outcome },
    );
  },
  async start(bookingId: string): Promise<{ booking: GarageJob }> {
    return api.patch<{ booking: GarageJob }>(
      `/api/garage/jobs/${bookingId}/start`,
    );
  },
  async complete(bookingId: string): Promise<{ booking: GarageJob }> {
    return api.patch<{ booking: GarageJob }>(
      `/api/garage/jobs/${bookingId}/complete`,
    );
  },
};

/** Map booking status → simple label for badges. */
export function statusLabel(s: BookingStatus): string {
  switch (s) {
    case "awaiting_garage":
      return "New";
    case "assigned":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "declined_by_garage":
      return "Declined";
    case "queued_for_call":
      return "Awaiting call";
    case "quoted":
      return "Quote ready";
  }
}
