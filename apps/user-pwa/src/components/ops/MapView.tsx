"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  Mechanic,
  OnboardingStatus,
  ServiceTag as ServiceTagType,
} from "@/lib/mechanics/types";

const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      Loading map…
    </div>
  ),
});

const LEGEND: Array<{ status: OnboardingStatus; label: string; color: string }> = [
  { status: "not_contacted", label: "Not contacted", color: "#b8b9c2" },
  { status: "contacted", label: "Contacted", color: "#ff6b2d" },
  { status: "interested", label: "Interested", color: "#00c2cb" },
  { status: "onboarded", label: "Onboarded", color: "#16a34a" },
  { status: "declined", label: "Declined", color: "#dc2626" },
];

const ALL_SERVICES: ServiceTagType[] = [
  "repair",
  "detailing",
  "denting",
  "tyres",
  "parts",
  "car_wash",
  "dealer",
];

export function MapView({ initial }: { initial: Mechanic[] }) {
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus | "">("");
  const [serviceFilter, setServiceFilter] = useState<ServiceTagType | "">("");
  const [hideDealersOnly, setHideDealersOnly] = useState(false);

  const visible = useMemo(() => {
    return initial.filter((m) => {
      if (statusFilter && m.onboardingStatus !== statusFilter) return false;
      if (serviceFilter && !m.services.includes(serviceFilter)) return false;
      if (hideDealersOnly) {
        const nonDealer = m.services.some((s) => s !== "dealer" && s !== "unknown");
        if (!nonDealer) return false;
      }
      return true;
    });
  }, [initial, statusFilter, serviceFilter, hideDealersOnly]);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value as ServiceTagType | "")}
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OnboardingStatus | "")}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">All statuses</option>
          {LEGEND.map((l) => (
            <option key={l.status} value={l.status}>
              {l.label}
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
        <span className="ms-auto text-xs text-muted-foreground tabular">
          {visible.length} of {initial.length} pins
        </span>
      </div>

      <div className="relative flex-1">
        <MapInner mechanics={visible} />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md border border-border bg-background/95 p-2 text-xs shadow-md">
          <div className="mb-1 font-semibold text-foreground">Status</div>
          <ul className="flex flex-col gap-1">
            {LEGEND.map((l) => (
              <li key={l.status} className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ background: l.color }}
                />
                {l.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
