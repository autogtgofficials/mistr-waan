"use client";

import { useMemo, useState } from "react";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { MechanicRow } from "./MechanicRow";
import { MechanicDetail } from "./MechanicDetail";
import type { Mechanic } from "@/lib/mechanics/types";

type Bucket = "overdue" | "today" | "tomorrow" | "this_week" | "later";

const BUCKET_META: Record<
  Bucket,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  overdue: {
    label: "Overdue",
    icon: <AlertTriangle className="size-4" strokeWidth={2} />,
    tone: "text-danger",
  },
  today: {
    label: "Due today",
    icon: <CalendarClock className="size-4" strokeWidth={2} />,
    tone: "text-ignite-700",
  },
  tomorrow: {
    label: "Tomorrow",
    icon: <CalendarClock className="size-4" strokeWidth={2} />,
    tone: "text-pulse-700",
  },
  this_week: {
    label: "Later this week",
    icon: <CalendarClock className="size-4" strokeWidth={2} />,
    tone: "text-foreground",
  },
  later: {
    label: "Later",
    icon: <CalendarClock className="size-4" strokeWidth={2} />,
    tone: "text-muted-foreground",
  },
};

export function FollowUpsView({ initial }: { initial: Mechanic[] }) {
  const [items, setItems] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);

  const knownAreas = useMemo(() => {
    const set = new Set<string>();
    for (const m of items) {
      if (m.area) set.add(m.area);
      for (const a of m.coverageAreas ?? []) set.add(a);
    }
    return [...set].sort();
  }, [items]);

  const grouped = useMemo(() => {
    const today = stripTime(new Date()).getTime();
    const tomorrow = today + 86400_000;
    const weekEnd = today + 7 * 86400_000;

    const buckets: Record<Bucket, Mechanic[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      this_week: [],
      later: [],
    };

    for (const m of items) {
      if (!m.nextFollowUpAt) continue;
      const t = stripTime(new Date(m.nextFollowUpAt)).getTime();
      if (t < today) buckets.overdue.push(m);
      else if (t === today) buckets.today.push(m);
      else if (t === tomorrow) buckets.tomorrow.push(m);
      else if (t <= weekEnd) buckets.this_week.push(m);
      else buckets.later.push(m);
    }

    for (const k of Object.keys(buckets) as Bucket[]) {
      buckets[k].sort((a, b) =>
        (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""),
      );
    }
    return buckets;
  }, [items]);

  const totals = (Object.keys(grouped) as Bucket[]).reduce(
    (acc, k) => {
      acc.total += grouped[k].length;
      if (k === "overdue") acc.overdue = grouped[k].length;
      if (k === "today") acc.today = grouped[k].length;
      return acc;
    },
    { total: 0, overdue: 0, today: 0 },
  );

  function patchInList(next: Mechanic) {
    setItems((prev) => prev.map((m) => (m.id === next.id ? next : m)));
  }

  const open = openId ? items.find((m) => m.id === openId) ?? null : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Total follow-ups"
          value={totals.total}
          icon={<CalendarClock className="size-4" strokeWidth={2} />}
        />
        <SummaryCard
          label="Overdue"
          value={totals.overdue}
          icon={<AlertTriangle className="size-4" strokeWidth={2} />}
          tone="danger"
        />
        <SummaryCard
          label="Due today"
          value={totals.today}
          icon={<CalendarClock className="size-4" strokeWidth={2} />}
          tone="warning"
        />
        <SummaryCard
          label="Cleared this week"
          value={items.filter((m) => isClearedRecently(m)).length}
          icon={<CheckCircle2 className="size-4" strokeWidth={2} />}
          tone="success"
        />
      </div>

      {totals.total === 0 ? (
        <div className="rounded-md border border-border-subtle bg-card p-10 text-center text-sm text-muted-foreground">
          No follow-ups scheduled yet. After each call, set a next-follow-up date so the
          mechanic shows up on this list when you need to circle back.
        </div>
      ) : null}

      {(["overdue", "today", "tomorrow", "this_week", "later"] as Bucket[]).map(
        (b) =>
          grouped[b].length > 0 ? (
            <section key={b} className="mb-8">
              <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${BUCKET_META[b].tone}`}>
                {BUCKET_META[b].icon}
                {BUCKET_META[b].label}
                <span className="text-xs font-normal text-muted-foreground">
                  ({grouped[b].length})
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {grouped[b].map((m) => (
                  <MechanicRow
                    key={m.id}
                    mechanic={m}
                    onOpenDetail={() => setOpenId(m.id)}
                    onPatched={patchInList}
                  />
                ))}
              </div>
            </section>
          ) : null,
      )}

      {open ? (
        <MechanicDetail
          mechanic={open}
          knownAreas={knownAreas}
          onClose={() => setOpenId(null)}
          onUpdated={patchInList}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "danger" | "warning" | "success";
}) {
  const cls =
    tone === "danger"
      ? "border-danger/40 bg-danger-soft"
      : tone === "warning"
        ? "border-ignite-200 bg-ignite-50"
        : tone === "success"
          ? "border-green-200 bg-green-50"
          : "border-border bg-card";
  const labelCls =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-ignite-800"
        : tone === "success"
          ? "text-green-800"
          : "text-muted-foreground";
  return (
    <div className={`rounded-md border p-4 ${cls}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${labelCls}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-foreground tabular">{value}</div>
    </div>
  );
}

function stripTime(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isClearedRecently(m: Mechanic): boolean {
  // Heuristic: latest call attempt within the last 7 days AND an active follow-up
  // exists OR the mechanic moved into onboarded/declined recently.
  const last = (m.callLog ?? [])
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!last) return false;
  const ago = (Date.now() - new Date(last.at).getTime()) / 86400_000;
  return ago <= 7;
}
