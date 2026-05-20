import { cn } from "@/lib/utils";
import type { GarageJobStatus } from "@/lib/mock/jobs";

const META: Record<
  GarageJobStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: {
    label: "New",
    bg: "bg-pulse-50",
    text: "text-pulse-700",
    dot: "bg-pulse-500",
  },
  quote_requested: {
    label: "Quote requested",
    bg: "bg-aqua-50",
    text: "text-aqua-700",
    dot: "bg-aqua-500",
  },
  assigned: {
    label: "Scheduled",
    bg: "bg-pulse-50",
    text: "text-pulse-700",
    dot: "bg-pulse-500",
  },
  in_progress: {
    label: "In progress",
    bg: "bg-orange-50",
    text: "text-ignite-700",
    dot: "bg-ignite-500",
  },
  completed: {
    label: "Completed",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-steel-300",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: GarageJobStatus;
  className?: string;
}) {
  const m = META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
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
