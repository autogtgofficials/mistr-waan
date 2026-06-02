import Link from "next/link";
import {
  Siren,
  Wrench,
  PaintBucket,
  Sparkles,
  Stars,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FEATURED_SERVICES,
  type ServiceCategoryId,
} from "@/lib/services/rate-card";
import { cn } from "@/lib/utils";

/**
 * Home service menu — the call-back model's front door.
 *
 *   • One prominent Roadside Assistance card (emergencies).
 *   • A few popular services as one-tap quick-picks → /services preselected.
 *   • "Explore all services" → the full multi-select catalog.
 */

const CATEGORY_ICON: Record<ServiceCategoryId, LucideIcon> = {
  repairs: Wrench,
  denting: PaintBucket,
  detailing: Sparkles,
  cosmetic: Stars,
};

export function ServiceMenu() {
  return (
    <div className="flex flex-col gap-3">
      {/* Roadside Assistance — the big one */}
      <Link
        href="/rsa"
        className="tap flex items-center gap-4 rounded-lg border border-ignite-100 bg-ignite-50 p-4 shadow-sm transition-transform active:scale-[0.99]"
      >
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-ignite-500 text-white"
          aria-hidden
        >
          <Siren className="size-6" strokeWidth={2} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-base font-semibold text-ignite-900">
            Roadside Assistance
          </span>
          <span className="text-sm text-ignite-800/80">
            Puncture, jump-start, towing, breakdown
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ignite-700" strokeWidth={2} />
      </Link>

      {/* Popular quick-picks */}
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        Popular services
      </p>
      <div className="grid grid-cols-2 gap-3">
        {FEATURED_SERVICES.map((s) => {
          const Icon = CATEGORY_ICON[s.category];
          return (
            <Link
              key={s.id}
              href={`/services?pick=${s.id}`}
              className="tap flex items-center gap-3 rounded-md border border-border bg-card p-3 shadow-sm transition-transform active:scale-[0.98]"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-pulse-50 text-pulse-700"
                aria-hidden
              >
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <span className="text-sm font-medium leading-tight text-foreground">
                {s.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Explore everything */}
      <Link
        href="/services"
        className={cn(
          "tap mt-1 flex items-center gap-4 rounded-lg border border-pulse-100 bg-pulse-50 p-4 transition-transform active:scale-[0.99]",
        )}
      >
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          aria-hidden
        >
          <LayoutGrid className="size-6" strokeWidth={2} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-base font-semibold text-pulse-900">
            Explore all services
          </span>
          <span className="text-sm text-pulse-900/70">
            Repairs, denting, detailing & more
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-pulse-700" strokeWidth={2} />
      </Link>
    </div>
  );
}
