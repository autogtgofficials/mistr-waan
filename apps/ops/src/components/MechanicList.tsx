"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { MechanicRow } from "./MechanicRow";
import { StatusBadge } from "./StatusBadge";
import { MechanicDetail } from "./MechanicDetail";
import { AddMechanicModal } from "./AddMechanicModal";
import {
  ONBOARDING_STATUSES,
  OUTCOME_BUCKETS,
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

type SortBy = "area" | "name" | "status" | "follow_up";
type FollowUpFilter = "" | "due_today" | "overdue" | "this_week" | "any";

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
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>(initialArea ?? "");
  const [service, setService] = useState<ServiceTagType | "">(
    (initialService as ServiceTagType | "") || "",
  );
  const [status, setStatus] = useState<OnboardingStatus | "">(
    (initialStatus as OnboardingStatus | "") || "",
  );
  const [outcomeBucket, setOutcomeBucket] = useState<
    "" | "won" | "warm" | "lost" | "no_reach" | "edge"
  >("");
  const [followUp, setFollowUp] = useState<FollowUpFilter>("");
  const [hideDealersOnly, setHideDealersOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("area");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => setItems(initial), [initial]);

  const areas = useMemo(() => {
    const set = new Map<string, number>();
    for (const m of items) {
      const a = m.area ?? "(unknown)";
      set.set(a, (set.get(a) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const knownAreas = useMemo(() => {
    const set = new Set<string>();
    for (const m of items) {
      if (m.area) set.add(m.area);
      for (const a of m.coverageAreas ?? []) set.add(a);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = stripTime(new Date());
    const inDays = (d: Date, n: number) =>
      (stripTime(d).getTime() - now.getTime()) / 86400_000 <= n;

    return items.filter((m) => {
      if (q) {
        const hay = [
          m.name,
          m.address,
          m.area,
          ...m.services,
          ...(m.detailedServices ?? []),
          ...(m.coverageAreas ?? []),
          m.businessProfile?.ownerName,
          m.businessProfile?.decisionMaker,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (area && (m.area ?? "(unknown)") !== area) return false;
      if (service && !m.services.includes(service)) return false;
      if (status && m.onboardingStatus !== status) return false;
      if (
        outcomeBucket &&
        (!m.outreachOutcome || OUTCOME_BUCKETS[m.outreachOutcome] !== outcomeBucket)
      ) {
        return false;
      }
      if (followUp) {
        if (!m.nextFollowUpAt) return followUp === "" as never;
        const d = new Date(m.nextFollowUpAt);
        if (followUp === "due_today") {
          if (stripTime(d).getTime() !== now.getTime()) return false;
        } else if (followUp === "overdue") {
          if (stripTime(d).getTime() >= now.getTime()) return false;
        } else if (followUp === "this_week") {
          if (!inDays(d, 7) || stripTime(d).getTime() < now.getTime()) return false;
        }
        // "any" passes
      }
      if (hideDealersOnly) {
        const nonDealer = m.services.some((s) => s !== "dealer" && s !== "unknown");
        if (!nonDealer) return false;
      }
      return true;
    });
  }, [items, query, area, service, status, outcomeBucket, followUp, hideDealersOnly]);

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
    if (sortBy === "follow_up") {
      // Sort by follow-up date ascending; mechanics without a follow-up come last.
      const sorted = [...filtered].sort((a, b) => {
        const ax = a.nextFollowUpAt ?? "9999";
        const bx = b.nextFollowUpAt ?? "9999";
        return ax.localeCompare(bx);
      });
      return [["By follow-up date", sorted]] as const;
    }
    return [["All", [...filtered].sort((a, b) => a.name.localeCompare(b.name))]] as const;
  }, [filtered, sortBy]);

  function clearFilters() {
    setQuery("");
    setArea("");
    setService("");
    setStatus("");
    setOutcomeBucket("");
    setFollowUp("");
    setHideDealersOnly(false);
  }

  function patchInList(next: Mechanic) {
    setItems((prev) => prev.map((m) => (m.id === next.id ? next : m)));
  }

  function addToList(mechanic: Mechanic) {
    setItems((prev) => [mechanic, ...prev]);
  }

  const open = openId ? items.find((m) => m.id === openId) ?? null : null;

  const hasActiveFilter =
    query || area || service || status || outcomeBucket || followUp || hideDealersOnly;

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
                placeholder="Search name, owner, address, service..."
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

            <select
              value={outcomeBucket}
              onChange={(e) =>
                setOutcomeBucket(e.target.value as typeof outcomeBucket)
              }
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All outcomes</option>
              <option value="won">Won</option>
              <option value="warm">Warm</option>
              <option value="lost">Lost</option>
              <option value="no_reach">Couldn&apos;t reach</option>
              <option value="edge">Edge</option>
            </select>

            <select
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value as FollowUpFilter)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">Any follow-up</option>
              <option value="due_today">Due today</option>
              <option value="overdue">Overdue</option>
              <option value="this_week">This week</option>
              <option value="any">Has follow-up</option>
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
                <option value="follow_up">By follow-up</option>
                <option value="name">By name</option>
              </select>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                Add mechanic
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <span className="tabular text-foreground font-medium">{filtered.length}</span> of {items.length} mechanics
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
                    <MechanicRow
                      key={m.id}
                      mechanic={m}
                      onOpenDetail={() => setOpenId(m.id)}
                      onPatched={patchInList}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {open ? (
        <MechanicDetail
          mechanic={open}
          knownAreas={knownAreas}
          onClose={() => setOpenId(null)}
          onUpdated={patchInList}
        />
      ) : null}

      {addOpen ? (
        <AddMechanicModal
          knownAreas={knownAreas}
          onClose={() => setAddOpen(false)}
          onAdded={addToList}
        />
      ) : null}
    </div>
  );
}

function stripTime(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
