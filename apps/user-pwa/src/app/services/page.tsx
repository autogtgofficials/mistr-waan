"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Phone } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft } from "@/lib/store/booking-draft";
import {
  SERVICE_CATEGORIES,
  serviceNames,
  bucketForServices,
} from "@/lib/services/rate-card";
import { cn } from "@/lib/utils";

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+917889686682";

/**
 * /services — pick what's wrong (multi-select), then book or call.
 *
 * No symptom/duration questions. The customer ticks one or more concrete
 * services from the rate card and taps Book — ops calls back to confirm the
 * details and price. A direct "Call us" option is always available.
 *
 * `?pick=<id>` preselects a service (used by the home quick-pick tiles).
 */
function ServicesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useBookingDraft();

  const preselect = searchParams.get("pick");
  const [selected, setSelected] = useState<string[]>(
    preselect ? [preselect] : [],
  );

  const count = selected.length;
  const names = useMemo(() => serviceNames(selected), [selected]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleBook() {
    if (count === 0) return;
    const bucket = bucketForServices(selected);
    update({
      bucket,
      serviceIds: selected,
      serviceNames: names,
      // Reset any prior garage pick — they choose (or skip) on the next screen.
      garageId: undefined,
      garageLabel: undefined,
      total: undefined,
    });
    // Optional "choose your garage (or let us pick)" step.
    router.push(`/garages?service=${bucket}&book=1`);
  }

  const dial = SUPPORT_PHONE.replace(/\s+/g, "");

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <Link
            href="/"
            aria-label="Back to home"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        }
        title={<span>Choose services</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">
            What&apos;s wrong with your car?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tick everything you need — we&apos;ll call you to confirm and price
            it. No payment now.
          </p>

          {SERVICE_CATEGORIES.map((cat) => (
            <section key={cat.id} className="mt-8 first:mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {cat.label}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{cat.blurb}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {cat.services.map((s) => {
                  const isOn = selected.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => toggle(s.id)}
                        aria-pressed={isOn}
                        className={cn(
                          "tap flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors active:scale-[0.99]",
                          isOn
                            ? "border-primary bg-primary-soft"
                            : "border-border bg-card hover:border-steel-300",
                        )}
                      >
                        <span className="text-base font-medium text-foreground">
                          {s.name}
                        </span>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            isOn ? "border-primary bg-primary" : "border-steel-300",
                          )}
                          aria-hidden
                        >
                          {isOn ? (
                            <Check
                              className="size-3 text-primary-foreground"
                              strokeWidth={3}
                            />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className="mt-8 rounded-md bg-muted/50 p-4 text-center">
            <p className="text-sm text-foreground">
              Not sure what you need?
            </p>
            <a
              href={`tel:${dial}`}
              className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Phone className="size-4" strokeWidth={2} />
              Call us and we&apos;ll help
            </a>
          </div>
        </div>
      </main>

      <BottomCTA>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {count === 0
                ? "Pick at least one service"
                : `${count} selected`}
            </span>
            <span className="text-sm font-semibold text-foreground">
              We&apos;ll call to confirm
            </span>
          </div>
          <Button onClick={handleBook} disabled={count === 0} inline className="px-6">
            Book ›
          </Button>
        </div>
      </BottomCTA>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full" />}>
      <ServicesInner />
    </Suspense>
  );
}
