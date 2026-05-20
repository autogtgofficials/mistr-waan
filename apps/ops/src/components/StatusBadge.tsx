import { cn } from "@/lib/utils";
import type { OnboardingStatus } from "@/lib/mechanics/types";

const META: Record<
  OnboardingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  not_contacted: {
    label: "Not contacted",
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-steel-300",
  },
  contacted: {
    label: "Contacted",
    bg: "bg-ignite-50",
    text: "text-ignite-700",
    dot: "bg-ignite-500",
  },
  interested: {
    label: "Interested",
    bg: "bg-aqua-50",
    text: "text-aqua-700",
    dot: "bg-aqua-500",
  },
  onboarded: {
    label: "Onboarded",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  declined: {
    label: "Declined",
    bg: "bg-danger-soft",
    text: "text-danger",
    dot: "bg-danger",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: OnboardingStatus;
  className?: string;
}) {
  const m = META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        m.bg,
        m.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

export function statusLabel(s: OnboardingStatus) {
  return META[s].label;
}
