"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PaintBucket } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft } from "@/lib/store/booking-draft";

/**
 * /denting — book denting & painting, we call you back.
 *
 * No upfront photo/description form: the customer confirms the booking and ops
 * arranges photos over WhatsApp (the ops booking screen has a one-tap "Request
 * photos" action) before quoting on the call.
 */
export default function DentingPage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();

  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "denting") {
      update({
        bucket: "denting",
        serviceIds: [],
        garageId: undefined,
        slot: undefined,
        denting: undefined,
      });
    }
  }, [hydrated, draft.bucket, update]);

  function handleBook() {
    update({ bucket: "denting", serviceIds: [], garageId: undefined });
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
        title={<span>Denting & Painting</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-ignite-50 px-3 py-1 text-xs font-semibold text-ignite-700">
            <PaintBucket className="size-3.5" strokeWidth={2.5} />
            Denting & painting
          </span>

          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Dents, scratches & paintwork.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Book it and our team calls you back. We&apos;ll ask for a few photos
            of the damage over WhatsApp, then share a quote — no upfront payment.
          </p>

          <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm text-foreground">
            <p className="font-semibold">How it works</p>
            <ol className="mt-3 flex flex-col gap-2">
              <li className="flex items-start gap-2">
                <span className="tabular font-semibold text-primary">1.</span>
                Tap book — we&apos;ll call you to confirm.
              </li>
              <li className="flex items-start gap-2">
                <span className="tabular font-semibold text-primary">2.</span>
                Send a few photos of the damage on WhatsApp.
              </li>
              <li className="flex items-start gap-2">
                <span className="tabular font-semibold text-primary">3.</span>
                We share the quote and arrange the body shop.
              </li>
            </ol>
          </div>
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handleBook} className="w-full">
          Book denting & painting — we&apos;ll call you
        </Button>
      </BottomCTA>
    </div>
  );
}
