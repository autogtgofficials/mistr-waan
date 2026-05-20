import Link from "next/link";
import { AlertTriangle, CheckCircle2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mechanic, OnboardingStatus, ServiceTag } from "@/lib/mechanics/types";

type AreaSummary = {
  area: string;
  total: number;
  onboarded: number;
  interested: number;
  contacted: number;
  dealersOnly: number;
  willServe: number; // mechanics located elsewhere who cover this area
  byService: Partial<Record<ServiceTag, number>>;
};

const GAP_THRESHOLD = 3;
const HEALTHY_THRESHOLD = 5;

function summarise(mechanics: Mechanic[]): AreaSummary[] {
  const byArea = new Map<string, Mechanic[]>();
  for (const m of mechanics) {
    const a = m.area ?? "(unknown)";
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a)!.push(m);
  }
  // Count mechanics whose coverageAreas explicitly include an area even when
  // they are not physically located there.
  const willServe = new Map<string, number>();
  for (const m of mechanics) {
    const home = m.area ?? "(unknown)";
    for (const a of m.coverageAreas ?? []) {
      if (a === home) continue;
      willServe.set(a, (willServe.get(a) ?? 0) + 1);
      if (!byArea.has(a)) byArea.set(a, []); // ensure the area appears in the bar chart
    }
  }
  return [...byArea.entries()]
    .map(([area, ms]) => {
      const summary: AreaSummary = {
        area,
        total: ms.length,
        onboarded: 0,
        interested: 0,
        contacted: 0,
        dealersOnly: 0,
        willServe: willServe.get(area) ?? 0,
        byService: {},
      };
      for (const m of ms) {
        if (m.onboardingStatus === "onboarded") summary.onboarded++;
        else if (m.onboardingStatus === "interested") summary.interested++;
        else if (m.onboardingStatus === "contacted") summary.contacted++;
        const onlyDealer = m.services.every((s) => s === "dealer" || s === "unknown");
        if (onlyDealer) summary.dealersOnly++;
        for (const s of m.services) summary.byService[s] = (summary.byService[s] ?? 0) + 1;
      }
      return summary;
    })
    .sort((a, b) => b.total + b.willServe - (a.total + a.willServe));
}

export function CoverageView({ mechanics }: { mechanics: Mechanic[] }) {
  const all = summarise(mechanics);
  const max = Math.max(...all.map((a) => a.total), 1);
  const totalAreas = all.length;
  const gaps = all.filter((a) => a.total < GAP_THRESHOLD);
  const wellCovered = all.filter((a) => a.total >= HEALTHY_THRESHOLD);
  const onboardedTotal = mechanics.filter((m) => m.onboardingStatus === "onboarded").length;
  const interestedTotal = mechanics.filter((m) => m.onboardingStatus === "interested").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Mechanics" value={mechanics.length} subtext={`${totalAreas} areas`} />
        <StatCard
          label="Well-covered areas"
          value={wellCovered.length}
          subtext={`≥${HEALTHY_THRESHOLD} mechanics`}
          accent="success"
          icon={<CheckCircle2 className="size-4" strokeWidth={2} />}
        />
        <StatCard
          label="Coverage gaps"
          value={gaps.length}
          subtext={`< ${GAP_THRESHOLD} mechanics`}
          accent="warning"
          icon={<AlertTriangle className="size-4" strokeWidth={2} />}
        />
        <StatCard
          label="Onboarded"
          value={onboardedTotal}
          subtext={`+${interestedTotal} interested`}
          accent="primary"
          icon={<Building2 className="size-4" strokeWidth={2} />}
        />
      </div>

      {/* Bar chart */}
      <section className="mt-8">
        <header className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mechanics per area</h2>
            <p className="text-xs text-muted-foreground">
              Green = onboarded · Aqua = interested · Steel = not yet engaged
            </p>
          </div>
          <Legend />
        </header>

        <div className="rounded-md border border-border bg-card">
          {all.map((a, i) => (
            <AreaBar key={a.area} summary={a} max={max} idx={i} />
          ))}
        </div>
      </section>

      {/* Gap callout */}
      {gaps.length > 0 ? (
        <section className="mt-8">
          <header className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-ignite-600" strokeWidth={2} />
            <h2 className="text-base font-semibold text-foreground">
              Coverage gaps — recruit here
            </h2>
            <span className="text-xs text-muted-foreground">
              ({gaps.length} areas with fewer than {GAP_THRESHOLD} mechanics)
            </span>
          </header>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {gaps.map((a) => (
              <Link
                key={a.area}
                href={`/?area=${encodeURIComponent(a.area)}`}
                className="rounded-md border border-ignite-200 bg-ignite-50 p-3 text-sm hover:bg-ignite-100"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ignite-900">{a.area}</span>
                  <span className="tabular text-xs font-semibold text-ignite-700">
                    {a.total} mechanic{a.total === 1 ? "" : "s"}
                  </span>
                </div>
                {a.onboarded > 0 ? (
                  <p className="mt-1 text-xs text-ignite-800">
                    {a.onboarded} onboarded — single point of failure
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AreaBar({ summary, max, idx }: { summary: AreaSummary; max: number; idx: number }) {
  const widthPct = (summary.total / max) * 100;
  const onboardedPct = (summary.onboarded / summary.total) * 100;
  const interestedPct = (summary.interested / summary.total) * 100;
  const contactedPct = (summary.contacted / summary.total) * 100;

  const isGap = summary.total < GAP_THRESHOLD;
  return (
    <div
      className={cn(
        "grid items-center gap-3 px-4 py-2.5 text-sm",
        "grid-cols-[140px_1fr_60px] md:grid-cols-[180px_1fr_80px]",
        idx > 0 && "border-t border-border-subtle",
        isGap && "bg-ignite-50/40",
      )}
    >
      <div className="truncate font-medium text-foreground">{summary.area}</div>
      <div className="relative h-5 overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full bg-steel-300"
          style={{ width: `${widthPct}%` }}
          aria-hidden
        />
        {/* Stacked segments for engaged statuses */}
        <div
          className="absolute inset-y-0 left-0 flex h-full"
          style={{ width: `${widthPct}%` }}
          aria-hidden
        >
          {summary.onboarded > 0 ? (
            <div className="h-full bg-green-500" style={{ width: `${onboardedPct}%` }} />
          ) : null}
          {summary.interested > 0 ? (
            <div className="h-full bg-aqua-500" style={{ width: `${interestedPct}%` }} />
          ) : null}
          {summary.contacted > 0 ? (
            <div className="h-full bg-ignite-400" style={{ width: `${contactedPct}%` }} />
          ) : null}
        </div>
      </div>
      <div className="text-end text-sm tabular font-semibold text-foreground">
        {summary.total}
        {summary.willServe > 0 ? (
          <span className="ms-1 text-xs font-normal text-pulse-600">
            +{summary.willServe} serve
          </span>
        ) : null}
        {isGap ? <span className="ms-1 text-xs text-ignite-600">gap</span> : null}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <Swatch color="bg-green-500" label="Onboarded" />
      <Swatch color="bg-aqua-500" label="Interested" />
      <Swatch color="bg-ignite-400" label="Contacted" />
      <Swatch color="bg-steel-300" label="Not contacted" />
    </ul>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-3 rounded-sm", color)} />
      {label}
    </li>
  );
}

function StatCard({
  label,
  value,
  subtext,
  accent,
  icon,
}: {
  label: string;
  value: number;
  subtext?: string;
  accent?: "success" | "warning" | "primary";
  icon?: React.ReactNode;
}) {
  const accentCls =
    accent === "success"
      ? "border-green-200 bg-green-50"
      : accent === "warning"
        ? "border-ignite-200 bg-ignite-50"
        : accent === "primary"
          ? "border-pulse-200 bg-pulse-50"
          : "border-border bg-card";
  const labelCls =
    accent === "success"
      ? "text-green-800"
      : accent === "warning"
        ? "text-ignite-800"
        : accent === "primary"
          ? "text-pulse-800"
          : "text-muted-foreground";
  return (
    <div className={cn("rounded-md border p-4", accentCls)}>
      <div className={cn("flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide", labelCls)}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-foreground tabular">{value}</div>
      {subtext ? <div className="mt-0.5 text-xs text-muted-foreground">{subtext}</div> : null}
    </div>
  );
}
