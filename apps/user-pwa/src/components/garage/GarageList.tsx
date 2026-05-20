"use client";

import { useMemo, useState } from "react";
import { ArrowDownNarrowWide, MapPinned } from "lucide-react";
import type { Garage } from "@/lib/mock/garages";
import { GarageCard } from "./GarageCard";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

/**
 * Garage list — the screen body for `/garages`.
 *
 * Sort options (per spec 3.5):
 *   - Soonest available  (default per Q4 = a)
 *   - Closest to me
 *   - Highest rated
 *
 * Default sort is "soonest". User changes sort via a chip → bottom sheet.
 */

type SortKey = "soonest" | "nearest" | "rating";

const SORT_LABELS: Record<SortKey, string> = {
  soonest: "Soonest available",
  nearest: "Closest to me",
  rating: "Highest rated",
};

interface GarageListProps {
  garages: Garage[];
  /** ?service= passed through to detail links so we keep context. */
  service?: string;
}

export function GarageList({ garages, service }: GarageListProps) {
  const [sort, setSort] = useState<SortKey>("soonest");
  const [sortOpen, setSortOpen] = useState(false);

  const sorted = useMemo(() => sortGarages(garages, sort), [garages, sort]);

  if (garages.length === 0) {
    return (
      <EmptyState
        icon={MapPinned}
        title="No garages available right now"
        body="Try a different time, or WhatsApp us for help."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Showing {garages.length} garage{garages.length === 1 ? "" : "s"} near you
        </p>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground active:scale-[0.98]"
        >
          <ArrowDownNarrowWide className="size-4 text-muted-foreground" strokeWidth={2} />
          <span>Sort:</span>
          <span className="font-semibold">{SORT_LABELS[sort]}</span>
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {sorted.map((garage) => (
          <li key={garage.id}>
            <GarageCard
              garage={garage}
              href={
                service
                  ? `/garages/${garage.id}?service=${service}`
                  : `/garages/${garage.id}`
              }
            />
          </li>
        ))}
      </ul>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort garages by">
        <ul className="flex flex-col">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
            const isSelected = key === sort;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    setSort(key);
                    setSortOpen(false);
                  }}
                  className={cn(
                    "tap flex w-full items-center justify-between rounded-md py-3 text-left",
                    "active:bg-muted",
                  )}
                >
                  <span className="text-base text-foreground">{SORT_LABELS[key]}</span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border-2",
                      isSelected ? "border-primary bg-primary" : "border-steel-300",
                    )}
                    aria-hidden
                  >
                    {isSelected ? (
                      <span className="size-2 rounded-full bg-primary-foreground" />
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

function sortGarages(list: Garage[], sort: SortKey): Garage[] {
  const copy = [...list];
  switch (sort) {
    case "nearest":
      return copy.sort((a, b) => a.distanceKm - b.distanceKm);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating);
    case "soonest":
    default:
      // Mock: order matches the seed array (which encodes earliest slot).
      // When real availability lands, sort by next-slot timestamp.
      return copy;
  }
}
