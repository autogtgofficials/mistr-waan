"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { SlotPicker, type SlotValue } from "@/components/booking/SlotPicker";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { getGarageById } from "@/lib/mock/garages";
import { ownerLabel } from "@/lib/utils";

/**
 * /booking/slot — date + time picker for the chosen garage.
 *
 * Reads garageId from draft. If missing, redirects back to home (defensive).
 */
export default function BookingSlotPage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();
  const [picked, setPicked] = useState<SlotValue | null>(draft.slot ?? null);

  useEffect(() => {
    if (!hydrated) return;
    if (!draft.garageId) {
      router.replace("/");
    }
  }, [hydrated, draft.garageId, router]);

  if (!hydrated || !draft.garageId) {
    return <div className="flex min-h-full" />;
  }

  const garage = getGarageById(draft.garageId);
  if (!garage) {
    return <div className="flex min-h-full" />;
  }

  function handleContinue() {
    if (!picked) return;
    update({ slot: picked });
    router.push("/booking/review");
  }

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
        title={<span>Pick a slot</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <p className="text-sm text-muted-foreground">
            With {ownerLabel(garage.ownerFirstName, garage.ownerLastName)} ·{" "}
            {garage.area}
          </p>

          <div className="mt-4">
            <SlotPicker initial={picked ?? undefined} onChange={setPicked} />
          </div>
        </div>
      </main>

      <BottomCTA>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Slot</span>
            <span className="text-sm font-semibold text-foreground">
              {picked ? picked.label : "Pick a time"}
            </span>
          </div>
          <Button onClick={handleContinue} disabled={!picked} inline className="px-6">
            Continue ›
          </Button>
        </div>
      </BottomCTA>
    </div>
  );
}
