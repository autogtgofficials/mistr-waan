"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Booking draft — the in-progress booking state shared across the
 * Catalog → Garages → Slot → Review → Pay → Confirmation flow.
 *
 * Mock-only V0: persisted to sessionStorage. When backend lands, this
 * shape becomes the request body for `POST /api/v1/jobs`.
 */

export type BookingBucket = "detailing" | "repairs" | "denting";

export interface BookingDraft {
  bucket?: BookingBucket;

  /** Selected service item ids (catalog slugs, e.g. "ac-compressor-repair"). */
  serviceIds: string[];

  /** Human-readable names for serviceIds — carried to ops since catalog is static. */
  serviceNames?: string[];

  /** Picked garage id (customer's preference — ops can override). */
  garageId?: string;

  /** Display label for the picked garage (e.g. "Imran K."), for the summary. */
  garageLabel?: string;

  /** Selected slot. ISO date + 24h time + display label. */
  slot?: { date: string; time: string; label: string };

  /** Chosen payment mode. */
  paymentMode?: "upi" | "cash";

  /** Latest computed total (in INR). For Repairs this is the upper estimate; for Detailing it's the sum. */
  total?: number;

  /** Repairs-specific symptom answers. */
  symptoms?: {
    category?: string;
    symptom?: string;
    duration?: string;
    photoCount?: number;
  };

  /** Denting-specific intake. */
  denting?: {
    description?: string;
    photoCount?: number;
    panels?: string[];
  };
}

const KEY = "mw_booking_draft";
const EMPTY: BookingDraft = { serviceIds: [] };

/** Read a snapshot of the draft (synchronous, non-reactive). */
export function readDraft(): BookingDraft {
  if (typeof window === "undefined") return EMPTY;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return EMPTY;
  try {
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return EMPTY;
  }
}

/** Imperative writer — useful in event handlers + non-component code. */
export function writeDraft(patch: Partial<BookingDraft>): BookingDraft {
  const prev = readDraft();
  const next = { ...prev, ...patch };
  if (typeof window !== "undefined") {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  }
  return next;
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

/** Reactive React hook — single source of truth in components. */
export function useBookingDraft() {
  const [draft, setDraft] = useState<BookingDraft>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraft(readDraft());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      sessionStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setDraft(EMPTY);
  }, []);

  return { draft, hydrated, update, reset };
}
