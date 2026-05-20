"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Star } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { getGaragesForBucket } from "@/lib/mock/garages";
import { ownerLabel, approxKm, rupees, cn } from "@/lib/utils";

/**
 * /denting/quotes/[id] — multi-quote display.
 *
 * V0 mock: we synthesize 3 quotes from the denting-capable garages with
 * varying prices and ETAs. After the simulated wait (1.5s), quotes appear.
 */

const QUOTE_VARIANTS = [
  {
    multiplier: 1.0,
    eta: "4 days",
    note: "Includes paint match + 6-month warranty.",
  },
  {
    multiplier: 1.18,
    eta: "3 days",
    note: "Premium paint — clear-coat finish.",
  },
  {
    multiplier: 0.85,
    eta: "5 days",
    note: "Budget option. PDR for the smallest dents.",
  },
];

const BASE_TOTAL = 18500;

export default function DentingQuotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();
  const [waiting, setWaiting] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);

  /* Mock the fan-out delay */
  useEffect(() => {
    const t = setTimeout(() => setWaiting(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "denting") router.replace("/denting");
  }, [hydrated, draft.bucket, router]);

  const dentingGarages = getGaragesForBucket("denting").slice(0, 3);
  const quotes = dentingGarages.map((g, i) => {
    const variant = QUOTE_VARIANTS[i] ?? QUOTE_VARIANTS[0];
    return {
      id: `${id}-${g.id}`,
      garage: g,
      total: Math.round((BASE_TOTAL * variant.multiplier) / 100) * 100,
      eta: variant.eta,
      note: variant.note,
    };
  });

  function handlePick() {
    if (picked === null) return;
    const chosen = quotes[picked];
    update({
      garageId: chosen.garage.id,
      total: chosen.total,
      slot: {
        date: new Date().toISOString().slice(0, 10),
        time: "10:00",
        label: `Drop off · ETA ${chosen.eta}`,
      },
    });
    router.push("/booking/review");
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <Link
            href="/denting"
            aria-label="Back"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        }
        title={<span>Quotes</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {waiting ? (
            <WaitingState garages={dentingGarages} />
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground">
                {quotes.length} quote{quotes.length === 1 ? "" : "s"} received
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare and pick. You&apos;ll pay 30% advance now, 70% after the job.
              </p>

              <ul className="mt-6 flex flex-col gap-3">
                {quotes.map((q, i) => {
                  const isOn = picked === i;
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(i)}
                        aria-pressed={isOn}
                        className={cn(
                          "tap flex w-full flex-col rounded-md border p-4 text-left transition-colors active:scale-[0.99]",
                          isOn
                            ? "border-primary bg-primary-soft"
                            : "border-border bg-card hover:border-steel-300",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-base font-semibold text-foreground">
                              {ownerLabel(q.garage.ownerFirstName, q.garage.ownerLastName)}
                            </span>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {q.garage.area} · {approxKm(q.garage.distanceKm)}
                            </div>
                          </div>
                          <span className="tabular text-xl font-bold text-foreground">
                            {rupees(q.total)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 text-foreground">
                            <Star
                              className="size-3.5 fill-ignite-500 text-ignite-500"
                              strokeWidth={1.5}
                            />
                            {q.garage.rating.toFixed(1)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-pulse-700">
                            <Clock className="size-3.5" strokeWidth={2} />
                            ETA {q.eta}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">{q.note}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {quotes.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  No quotes yet. We&apos;ll WhatsApp you as soon as a garage responds.
                </p>
              ) : null}
            </>
          )}
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handlePick} disabled={picked === null}>
          Continue with this quote ›
        </Button>
      </BottomCTA>
    </div>
  );
}

function WaitingState({
  garages,
}: {
  garages: ReturnType<typeof getGaragesForBucket>;
}) {
  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">Sending to garages…</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Quotes typically arrive within 24 hours. We&apos;ll WhatsApp you when ready.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {garages.slice(0, 3).map((g) => (
          <li
            key={g.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
          >
            <span className="size-3 shrink-0 animate-pulse rounded-full bg-aqua-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {ownerLabel(g.ownerFirstName, g.ownerLastName)}
              </span>
              <span className="text-xs text-muted-foreground">{g.area}</span>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">Waiting…</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
