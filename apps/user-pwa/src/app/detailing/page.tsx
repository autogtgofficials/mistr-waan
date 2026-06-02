"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { detailingServices } from "@/lib/mock/services";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { rupees, cn } from "@/lib/utils";

/**
 * /detailing — service catalog (multi-select).
 *
 * Per design 4.1: tap to toggle, sticky bottom shows running total +
 * Continue CTA. Selection persisted into the booking draft so the rest
 * of the flow has it.
 */
export default function DetailingCatalogPage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();

  /* Mark this draft as the Detailing flow on first visit. */
  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "detailing") {
      update({ bucket: "detailing", serviceIds: [], garageId: undefined, slot: undefined });
    }
  }, [hydrated, draft.bucket, update]);

  const [selected, setSelected] = useState<string[]>(draft.serviceIds);
  /* Keep local + draft in sync after hydration */
  useEffect(() => {
    if (hydrated && draft.bucket === "detailing") setSelected(draft.serviceIds);
  }, [hydrated, draft.bucket, draft.serviceIds]);

  const total = useMemo(
    () =>
      selected.reduce((acc, id) => {
        const item = detailingServices.find((s) => s.id === id);
        return acc + (item?.price ?? 0);
      }, 0),
    [selected],
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleContinue() {
    update({
      bucket: "detailing",
      serviceIds: selected,
      total,
      // Call-back model: ops picks the garage, so we no longer carry one.
      garageId: undefined,
    });
    router.push("/booking/request");
  }

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
        title={<span>Detailing</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">Pick the services you need.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-select. Total updates as you go.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {detailingServices.map((item) => {
              const isOn = selected.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-pressed={isOn}
                    className={cn(
                      "tap flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors active:scale-[0.99]",
                      isOn
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-card hover:border-steel-300",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        isOn ? "border-primary bg-primary" : "border-steel-300",
                      )}
                      aria-hidden
                    >
                      {isOn ? (
                        <Check className="size-3 text-primary-foreground" strokeWidth={3} />
                      ) : null}
                    </span>
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="tabular text-base font-medium text-foreground">
                          {rupees(item.price)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.duration}</span>
                      {item.blurb ? (
                        <span className="mt-1 text-sm text-muted-foreground">{item.blurb}</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>

      <BottomCTA>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {selected.length === 0
                ? "Pick at least one service"
                : `${selected.length} service${selected.length === 1 ? "" : "s"}`}
            </span>
            <span className="tabular text-lg font-bold text-foreground">{rupees(total)}</span>
          </div>
          <Button
            onClick={handleContinue}
            disabled={selected.length === 0}
            inline
            className="px-6"
          >
            Continue ›
          </Button>
        </div>
      </BottomCTA>
    </div>
  );
}
