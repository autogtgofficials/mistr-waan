"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useJobs } from "@/lib/store/jobs";
import { getGarageById } from "@/lib/mock/garages";
import { ownerLabel, cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";

export function ActiveJobBar() {
  const { activeJob, hydrated } = useJobs();
  const locale = useLocale();
  if (!hydrated || !activeJob) return null;

  const garage = getGarageById(activeJob.garageId);
  if (!garage) return null;

  const name = ownerLabel(garage.ownerFirstName, garage.ownerLastName);

  return (
    <Link
      href={`/bookings/${activeJob.id}`}
      className={cn(
        "tap flex h-10 items-center gap-2 border-b border-pulse-100 bg-pulse-50 px-4 text-sm text-pulse-900",
        locale === "ur" && "font-urdu",
      )}
    >
      <span className="inline-block size-2 shrink-0 rounded-full bg-pulse-500" aria-hidden />
      <span className="truncate">
        <span className="font-semibold">{t(locale, "active.label")}:</span>{" "}
        {t(locale, "active.with", { name })}
        {activeJob.status === "in_progress" ? ` — ${t(locale, "active.inProgress")}` : null}
      </span>
      <span className="ms-auto inline-flex items-center font-medium">
        {t(locale, "active.track")}
        <ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2.5} />
      </span>
    </Link>
  );
}
