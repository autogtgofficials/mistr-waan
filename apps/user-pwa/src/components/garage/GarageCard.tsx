import Link from "next/link";
import { Star, Clock } from "lucide-react";
import type { GarageSummary } from "@/lib/garage/summary";
import { ownerLabel, jobsDoneLabel, cn } from "@/lib/utils";

/**
 * GarageCard — the single most-rendered component in the user PWA.
 *
 * Pre-booking surface (locked rules):
 *   ✓ Owner first name + last initial    ("Imran K.")
 *   ✓ Area / locality                    ("Hyderpora area")
 *   ✓ Rating + jobs done
 *   ✓ Working hours (when known)
 *
 * NEVER shown pre-booking:
 *   ✗ Shop name   ✗ Street address / map / pin   ✗ Phone number
 */

export interface GarageCardProps {
  garage: GarageSummary;
  /** Optional href — when provided, the card becomes a link. */
  href?: string;
  /** Hides the avatar for tight contexts (e.g. review screen). */
  compact?: boolean;
  className?: string;
}

export function GarageCard({ garage, href, compact = false, className }: GarageCardProps) {
  const Wrapper = href ? Link : "article";
  const wrapperProps = href ? { href } : {};

  const isNewGarage = garage.jobsCompleted === 0;

  return (
    <Wrapper
      {...(wrapperProps as { href: string })}
      className={cn(
        "tap block rounded-md border border-border bg-card p-4 shadow-sm transition-transform",
        href && "active:scale-[0.99]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {compact ? null : <Avatar firstName={garage.ownerFirstName} lastName={garage.ownerLastName} />}

        <div className="flex flex-1 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-semibold text-foreground">
              {ownerLabel(garage.ownerFirstName, garage.ownerLastName)}
            </span>
            {isNewGarage ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide rounded-full bg-aqua-50 text-aqua-700 px-2 py-0.5">
                New
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 text-sm text-muted-foreground">{garage.area}</div>

          <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
            {isNewGarage ? (
              <span className="text-muted-foreground">{jobsDoneLabel(garage.jobsCompleted)}</span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-ignite-500 text-ignite-500" strokeWidth={1.5} />
                  <span className="font-medium">{garage.rating.toFixed(1)}</span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{jobsDoneLabel(garage.jobsCompleted)}</span>
              </>
            )}
          </div>

          {garage.workingHours ? (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-pulse-700">
              <Clock className="size-4" strokeWidth={2} />
              <span className="font-medium">{garage.workingHours}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Wrapper>
  );
}

/** Owner avatar — initials on tinted bg. */
function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials =
    (firstName.charAt(0) + (lastName.charAt(0) || "")).toUpperCase() || "?";
  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-md bg-pulse-100 text-pulse-700 text-sm font-semibold"
      aria-hidden
    >
      {initials}
    </span>
  );
}
