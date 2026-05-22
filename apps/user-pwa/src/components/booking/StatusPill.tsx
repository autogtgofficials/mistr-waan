"use client";

import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/store/jobs";
import { useLocale } from "@/lib/i18n/client";
import { t, type DictKey } from "@/lib/i18n/dict";

const STATUS_META: Record<
  JobStatus,
  { labelKey: DictKey; bg: string; text: string; dot: string }
> = {
  queued_for_call: {
    labelKey: "status.queued_for_call",
    bg: "bg-pulse-50",
    text: "text-pulse-700",
    dot: "bg-pulse-500",
  },
  quoted: {
    labelKey: "status.quoted",
    bg: "bg-pulse-50",
    text: "text-pulse-700",
    dot: "bg-pulse-500",
  },
  awaiting_garage: {
    labelKey: "status.awaiting_garage",
    bg: "bg-pulse-50",
    text: "text-pulse-700",
    dot: "bg-pulse-500",
  },
  assigned: {
    labelKey: "status.assigned",
    bg: "bg-pulse-50",
    text: "text-pulse-700",
    dot: "bg-pulse-500",
  },
  in_progress: {
    labelKey: "status.in_progress",
    bg: "bg-orange-50",
    text: "text-ignite-700",
    dot: "bg-ignite-500",
  },
  completed: {
    labelKey: "status.completed",
    bg: "bg-aqua-50",
    text: "text-aqua-700",
    dot: "bg-aqua-500",
  },
  cancelled: {
    labelKey: "status.cancelled",
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-steel-300",
  },
  declined_by_garage: {
    labelKey: "status.declined_by_garage",
    bg: "bg-orange-50",
    text: "text-ignite-700",
    dot: "bg-ignite-500",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const locale = useLocale();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        meta.bg,
        meta.text,
        locale === "ur" && "font-urdu",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {t(locale, meta.labelKey)}
    </span>
  );
}
