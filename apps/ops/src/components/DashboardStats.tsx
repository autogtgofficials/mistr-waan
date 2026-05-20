import type { Mechanic } from "@/lib/mechanics/types";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: "success" | "danger" | "aqua" | "warning" | "muted";
}) {
  const valueClass =
    accent === "success"
      ? "text-success"
      : accent === "danger"
        ? "text-danger"
        : accent === "aqua"
          ? "text-aqua-600"
          : accent === "warning"
            ? "text-warning"
            : "text-foreground";

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`text-2xl font-bold tabular ${valueClass}`}>
        {value.toLocaleString("en-IN")}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function DashboardStats({ mechanics }: { mechanics: Mechanic[] }) {
  const total = mechanics.length;
  const onboarded = mechanics.filter((m) => m.onboardingStatus === "onboarded").length;
  const interested = mechanics.filter((m) => m.onboardingStatus === "interested").length;
  const contacted = mechanics.filter((m) => m.onboardingStatus === "contacted").length;
  const notContacted = mechanics.filter((m) => m.onboardingStatus === "not_contacted").length;
  const declined = mechanics.filter((m) => m.onboardingStatus === "declined").length;
  const manual = mechanics.filter((m) => m.source === "manual").length;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdueFollowUps = mechanics.filter((m) => {
    if (!m.nextFollowUpAt) return false;
    const d = new Date(m.nextFollowUpAt);
    d.setHours(0, 0, 0, 0);
    return d < now;
  }).length;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
  const callsThisWeek = mechanics.reduce((sum, m) => {
    return sum + (m.callLog ?? []).filter((c) => new Date(c.at) >= sevenDaysAgo).length;
  }, 0);

  const pipeline = interested + contacted;

  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Total" value={total} sub={manual > 0 ? `${manual} manually added` : undefined} />
          <StatCard label="Onboarded" value={onboarded} accent="success" />
          <StatCard label="In pipeline" value={pipeline} accent="aqua" sub={`${interested} interested · ${contacted} contacted`} />
          <StatCard label="Not contacted" value={notContacted} accent="muted" />
          <StatCard label="Declined" value={declined} />
          <StatCard label="Overdue" value={overdueFollowUps} accent={overdueFollowUps > 0 ? "danger" : "muted"} sub="follow-ups" />
          <StatCard label="Calls" value={callsThisWeek} sub="last 7 days" />
          <StatCard
            label="Coverage"
            value={Math.round(((total - notContacted) / total) * 100)}
            sub="% contacted"
            accent="aqua"
          />
        </div>
      </div>
    </div>
  );
}
