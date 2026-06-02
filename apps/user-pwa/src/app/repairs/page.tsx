"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft } from "@/lib/store/booking-draft";

/**
 * /repairs — book a repair, we call you back.
 *
 * No symptom questionnaire and no slot picker: the customer just confirms a
 * repair booking and our team rings them to diagnose and arrange the mechanic.
 * The examples below are reassurance, not a form.
 */

const EXAMPLES = [
  "AC not cooling / AC repair",
  "Brakes, clutch & gears",
  "Engine warning light",
  "Battery & electricals",
  "Starting trouble",
  "Suspension & steering",
];

export default function RepairsPage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();

  // Reset any stale draft into a clean repairs request.
  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "repairs") {
      update({
        bucket: "repairs",
        serviceIds: [],
        garageId: undefined,
        slot: undefined,
        symptoms: undefined,
      });
    }
  }, [hydrated, draft.bucket, update]);

  function handleBook() {
    update({ bucket: "repairs", serviceIds: [], garageId: undefined });
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
        title={<span>Repairs</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-pulse-50 px-3 py-1 text-xs font-semibold text-pulse-700">
            <Wrench className="size-3.5" strokeWidth={2.5} />
            Car & bike repairs
          </span>

          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Something not right? We&apos;ll sort it.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Book a repair and our team calls you back to understand the issue,
            arrange the right mechanic, and confirm the price. No forms, no
            upfront payment.
          </p>

          <div className="mt-6 rounded-md border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">
              We handle things like
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {EXAMPLES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handleBook} className="w-full">
          Book a repair — we&apos;ll call you
        </Button>
      </BottomCTA>
    </div>
  );
}
