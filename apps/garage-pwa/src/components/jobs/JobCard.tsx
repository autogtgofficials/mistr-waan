"use client";

import Link from "next/link";
import { ChevronRight, Wallet, Wrench, Sparkles, PaintBucket } from "lucide-react";
import { StatusPill } from "./StatusPill";
import { rupees, cn } from "@/lib/utils";
import type { GarageJob } from "@/lib/mock/jobs";

const BUCKET_ICON = {
  detailing: Sparkles,
  repairs: Wrench,
  denting: PaintBucket,
};

export function JobCard({ job }: { job: GarageJob }) {
  const Icon = BUCKET_ICON[job.bucket];
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="tap block rounded-md border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md",
              job.bucket === "detailing"
                ? "bg-aqua-50 text-aqua-700"
                : job.bucket === "repairs"
                  ? "bg-pulse-50 text-pulse-700"
                  : "bg-ignite-50 text-ignite-700",
            )}
            aria-hidden
          >
            <Icon className="size-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{job.summary}</span>
            <span className="text-xs text-muted-foreground">
              {job.customerLabel} · {job.customerArea}
            </span>
            <span className="mt-1 text-xs text-foreground">{job.slotLabel}</span>
          </div>
        </div>
        <StatusPill status={job.status} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs">
        <span className="inline-flex items-center gap-1 text-foreground">
          <Wallet className="size-3.5" strokeWidth={2} />
          {job.total > 0 ? rupees(job.total) : "—"}{" "}
          <span className="text-muted-foreground">
            {job.paymentMode === "upi" ? "(UPI)" : "(Cash)"}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-primary font-medium">
          View
          <ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
