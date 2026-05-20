"use client";

import { useCallback, useEffect, useState } from "react";
import { SEED_JOBS, type GarageJob, type GarageJobStatus } from "@/lib/mock/jobs";

const KEY = "mw_garage_jobs";

function readAll(): GarageJob[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GarageJob[];
  } catch {
    return [];
  }
}

function writeAll(jobs: GarageJob[]) {
  sessionStorage.setItem(KEY, JSON.stringify(jobs));
}

/** Reactive jobs hook — auto-seeds on first mount if empty. */
export function useGarageJobs() {
  const [jobs, setJobs] = useState<GarageJob[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial = readAll();
    if (initial.length === 0) {
      initial = SEED_JOBS;
      writeAll(initial);
    }
    setJobs(initial);
    setHydrated(true);
  }, []);

  const updateStatus = useCallback((id: string, status: GarageJobStatus) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, status } : j));
      writeAll(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    writeAll(SEED_JOBS);
    setJobs(SEED_JOBS);
  }, []);

  /* Derived buckets */
  const pending = jobs.filter((j) => j.status === "pending");
  const quoteRequested = jobs.filter((j) => j.status === "quote_requested");
  const active = jobs.filter(
    (j) => j.status === "assigned" || j.status === "in_progress",
  );
  const completed = jobs.filter((j) => j.status === "completed");
  const cancelled = jobs.filter((j) => j.status === "cancelled");

  return {
    jobs,
    hydrated,
    pending,
    quoteRequested,
    active,
    completed,
    cancelled,
    updateStatus,
    reset,
  };
}
