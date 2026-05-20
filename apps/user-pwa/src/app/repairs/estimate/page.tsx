"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, AlertCircle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { getEstimate } from "@/lib/mock/symptoms";
import { rupees } from "@/lib/utils";

/**
 * /repairs/estimate — shows the estimator output.
 *
 * Per design 7.2: if no match in lookup table, render "Garage will inspect"
 * fallback (no fake price). Honors decision to drop the "AI" framing.
 */
export default function RepairsEstimatePage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();

  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "repairs" || !draft.symptoms?.category) {
      router.replace("/repairs");
    }
  }, [hydrated, draft.bucket, draft.symptoms, router]);

  const est = useMemo(
    () => getEstimate(draft.symptoms?.category, draft.symptoms?.symptom),
    [draft.symptoms],
  );

  function handleContinue() {
    update({ total: est?.rangeMax });
    router.push("/garages?service=repairs");
  }

  if (!hydrated) return <div className="flex min-h-full" />;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </button>
        }
        title={<span>Estimated price</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-aqua-50 px-3 py-1 text-xs font-semibold text-aqua-800">
            <Wrench className="size-3.5" strokeWidth={2.5} />
            Repairs
          </span>

          {est ? (
            <>
              <h1 className="mt-4 text-3xl font-bold text-foreground tabular">
                {rupees(est.rangeMin)} – {rupees(est.rangeMax)}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Based on average prices for this issue across nearby garages.
              </p>

              <div className="mt-6 rounded-md border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Likely needed</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {est.likelyItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-md bg-orange-50 border border-orange-100 p-4">
                <AlertCircle className="size-5 shrink-0 text-ignite-700" strokeWidth={2} />
                <p className="text-sm text-ignite-900">
                  <span className="font-semibold">Final price set after inspection.</span> Garage
                  may quote less or more depending on what they find.
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-bold text-foreground">
                Garage will inspect
              </h1>
              <p className="mt-2 text-base text-foreground">No estimate yet for this one.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a garage, drop in, and the mechanic will quote after a look.
              </p>
            </>
          )}

          <div className="mt-6">
            <Link
              href="/repairs"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              ← Re-answer the symptom form
            </Link>
          </div>
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handleContinue}>Pick a garage ›</Button>
      </BottomCTA>
    </div>
  );
}
