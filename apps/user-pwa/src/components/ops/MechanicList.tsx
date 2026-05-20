"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { MechanicRow } from "./MechanicRow";
import { StatusBadge } from "./StatusBadge";
import {
  ONBOARDING_STATUSES,
  type Mechanic,
  type OnboardingStatus,
  type ServiceTag as ServiceTagType,
} from "@/lib/mechanics/types";

const ALL_SERVICES: ServiceTagType[] = [
  "repair",
  "detailing",
  "denting",
  "tyres",
  "parts",
  "car_wash",
  "dealer",
];

type SortBy = "area" | "name" | "status";

export function MechanicList({
  initial,
  initialArea,
  initialStatus,
  initialService,
}: {
  initial: Mechanic[];
  initialArea?: string;
  initialStatus?: string;
  initialService?: string;
}) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>(initialArea ?? "");
  const [service, setService] = useState<ServiceTagType | "">(
    (initialService as ServiceTagType | "") || "",
  );
  const [status, setStatus] = useState<OnboardingStatus | "">(
    (initialStatus as OnboardingStatus | "") || "",
  );
  const [hideDealersOnly, setHideDealersOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("area");

  const areas = useMemo(() => {
    const set = new Map<string, number>();
    for (const m of initial) {
      const a = m.area ?? "(unknown)";
      set.set(a, (set.get(a) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [initial]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.filter((m) => {
      if (q) {
        const hay = [m.name, m.address, m.area, ...m.services].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (area && (m.area ?? "(unknown)") !== area) return false;
      if (service && !m.services.includes(service)) return false;
      if (status && m.onboardingStatus !== status) return false;
      if (hideDealersOnly) {
        const nonDealer = m.services.some((s) => s !== "dealer" && s !== "unknown");
        if (!nonDealer) return false;
      }
      return true;
    });
  }, [initial, query, area, service, status, hideDealersOnly]);

  const grouped = useMemo(() => {
    if (sortBy === "area") {
      const byArea = new Map<string, Mechanic[]>();
      for (const m of filtered) {
        const a = m.area ?? "(unknown)";
        if (!byArea.has(a)) byArea.set(a, []);
        byArea.get(a)!.push(m);
      }
      return [...byArea.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([k, v]) => [k, v.sort((x, y) => x.name.localeCompare(y.name))] as const);
    }
    if (sortBy === "status") {
      const byStatus = new Map<OnboardingStatus, Mechanic[]>();
      for (const m of filtered) {
        if (!byStatus.has(m.onboardingStatus)) byStatus.set(m.onboardingStatus, []);
        byStatus.get(m.onboardingStatus)!.push(m);
      }
      return ONBOARDING_STATUSES.filter((s) => byStatus.has(s)).map(
        (s) => [s, byStatus.get(s)!.sort((x, y) => x.name.localeCompare(y.name))] as const,
      );
    }
    // name sort: single big group
    return [["All", [...filtered].sort((a, b) => a.name.localeCompare(b.name))]] as const;
  }, [filtered, sortBy]);

  function clearFilters() {
    setQuery("");
    setArea("");
    setService("");
    setStatus("");
    setHideDealersOnly(false);
  }

  const hasActiveFilter = query || area || service || status || hideDealersOnly;

  return (
    <div className="flex flex-col">
      {/* Filter bar */}
      <div className="sticky top-[57px] z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or address..."
                className="w-full rounded-md border border-input bg-background py-1.5 ps-8 pe-2 text-sm text-foreground placeholder:text-steel-300 focus:ring-2 focus:ring-ring"
              />
            </div>

            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All areas</option>
              {areas.map(([a, n]) => (
                <option key={a} value={a}>
                  {a} ({n})
                </option>
              ))}
            </select>

            <select
              value={service}
              onChange={(e) => setService(e.target.value as ServiceTagType | "")}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All services</option>
              {ALL_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OnboardingStatus | "")}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All statuses</option>
              {ONBOARDING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground">
              <input
                type="checkbox"
                checked={hideDealersOnly}
                onChange={(e) => setHideDealersOnly(e.target.checked)}
              />
              Hide pure dealerships
            </label>

            <div className="ms-auto flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="area">By area</option>
                <option value="status">By status</option>
                <option value="name">By name</option>
              </select>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <span className="tabular text-foreground font-medium">{filtered.length}</span> of {initial.length} mechanics
            </span>
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-pulse-600 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* List body */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {filtered.length === 0 ? (
          <div className="rounded-md border border-border-subtle bg-card p-10 text-center text-sm text-muted-foreground">
            No mechanics match these filters.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {grouped.map(([key, list]) => (
              <section key={String(key)}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {sortBy === "status" ? (
                    <StatusBadge status={key as OnboardingStatus} />
                  ) : (
                    <span className="text-foreground">{String(key)}</span>
                  )}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({list.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {list.map((m) => (
                    <MechanicRow key={m.id} mechanic={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
