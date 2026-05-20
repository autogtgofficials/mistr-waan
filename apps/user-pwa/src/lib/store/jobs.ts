"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingBucket } from "./booking-draft";

/**
 * Mock jobs store — V0 only. Bookings are persisted in sessionStorage.
 * Real jobs land when backend joins; this keeps the UI demoable.
 */

export type JobStatus =
  | "assigned" /* booked, garage notified — slot pending */
  | "in_progress" /* garage marked started */
  | "completed" /* garage marked done; user can rate */
  | "cancelled";

export interface Job {
  id: string;
  bucket: BookingBucket;
  serviceIds: string[];
  garageId: string;
  slotLabel: string;
  paymentMode: "upi" | "cash";
  total: number;
  status: JobStatus;
  createdAt: string; // ISO
  rating?: 1 | 2 | 3 | 4 | 5;
}

const KEY = "mw_mock_jobs";

function readAll(): Job[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Job[];
  } catch {
    return [];
  }
}

function writeAll(jobs: Job[]) {
  sessionStorage.setItem(KEY, JSON.stringify(jobs));
}

export function newJobId(): string {
  // Format: MW-XXXXXX
  return `MW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Synchronous read. */
export function getJob(id: string): Job | undefined {
  return readAll().find((j) => j.id === id);
}

/** Synchronous create — returns the new Job (with generated id). */
export function createJob(input: Omit<Job, "id" | "createdAt" | "status">): Job {
  const job: Job = {
    ...input,
    id: newJobId(),
    createdAt: new Date().toISOString(),
    status: "assigned",
  };
  const next = [...readAll(), job];
  writeAll(next);
  return job;
}

/** Reactive React hook for the jobs list. */
export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setJobs(readAll());
    setHydrated(true);

    function handleStorage(e: StorageEvent) {
      if (e.key === KEY) setJobs(readAll());
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const update = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, ...patch } : j));
      writeAll(next);
      return next;
    });
  }, []);

  const cancel = useCallback(
    (id: string) => update(id, { status: "cancelled" }),
    [update],
  );

  const activeJob = jobs.find(
    (j) => j.status === "assigned" || j.status === "in_progress",
  );

  return { jobs, hydrated, update, cancel, activeJob };
}
