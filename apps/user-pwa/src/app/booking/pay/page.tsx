"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft, clearDraft } from "@/lib/store/booking-draft";
import { useAuth } from "@/lib/store/auth";
import { getGarageById } from "@/lib/mock/garages";
import { detailingServices } from "@/lib/mock/services";
import { rupees, cn } from "@/lib/utils";

/**
 * /booking/pay — payment method screen.
 *
 * UPI is selected by default with "Recommended" pill (locked Q-block,
 * UPI-default with cash one-tap-below). On Confirm:
 *   - UPI:  fake 1.5s "Razorpay" delay → create job → confirmation
 *   - Cash: create job immediately → confirmation
 */
export default function BookingPayPage() {
  const router = useRouter();
  const { draft, hydrated } = useBookingDraft();
  const { isAuthed, hydrated: authHydrated } = useAuth();
  const [mode, setMode] = useState<"upi" | "cash">("upi");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !authHydrated) return;
    if (!isAuthed) {
      router.replace(`/login?next=${encodeURIComponent("/booking/pay")}`);
      return;
    }
    if (!draft.garageId || !draft.slot) router.replace("/");
  }, [hydrated, authHydrated, isAuthed, draft.garageId, draft.slot, router]);

  const garage = draft.garageId ? getGarageById(draft.garageId) : undefined;
  const total = useMemo(() => {
    if (draft.total) return draft.total;
    return (draft.serviceIds ?? []).reduce((acc, id) => {
      const item = detailingServices.find((s) => s.id === id);
      return acc + (item?.price ?? 0);
    }, 0);
  }, [draft.total, draft.serviceIds]);

  if (!hydrated || !garage || !draft.slot) {
    return <div className="flex min-h-full" />;
  }

  function handleConfirm() {
    if (!garage || !draft.slot) return;
    setError(null);

    startTransition(async () => {
      if (mode === "upi") {
        // TODO Week 3: real Razorpay Checkout. Until then, fake the wait so
        // the flow feels natural; we still hit the cash code path on the API
        // (the server will eventually require a captured payment row before
        // moving status off 'queued_for_call').
        await new Promise((r) => setTimeout(r, 1500));
      }

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bucket: draft.bucket ?? "detailing",
            serviceIds: draft.serviceIds ?? [],
            garageId: garage.id, // ops may reassign; UI passes user's pick as a hint
            slotLabel: draft.slot!.label,
            paymentMode: mode,
            symptoms: draft.symptoms ?? null,
            denting: draft.denting ?? null,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 401) {
            router.replace(`/login?next=${encodeURIComponent("/booking/pay")}`);
            return;
          }
          setError(
            data.error === "invalid_payment_mode"
              ? "That payment method isn't supported."
              : "Couldn't confirm your booking. Please try again.",
          );
          return;
        }

        const data = (await res.json()) as { booking: { id: string; shortId: string } };
        clearDraft();
        // Confirmation page is keyed by the human short_id (MW-XXXXXX) for
        // readability. The API supports lookup by either, but URLs use short.
        router.replace(`/booking/confirmation/${data.booking.shortId}`);
      } catch {
        setError("Network problem — check your connection and try again.");
      }
    });
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
        title={<span>How will you pay?</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="tabular text-3xl font-bold text-foreground">
              {total > 0 ? rupees(total) : "After inspection"}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <PaymentOption
              checked={mode === "upi"}
              onChange={() => setMode("upi")}
              title="Pay with UPI"
              subtitle="Cards / netbanking also work"
              recommended
            />
            <PaymentOption
              checked={mode === "cash"}
              onChange={() => setMode("cash")}
              title="Pay cash at the garage"
              subtitle="When the job is done"
            />
          </div>

          {mode === "upi" ? (
            <div className="mt-6 flex items-start gap-3 rounded-md bg-pulse-50 border border-pulse-100 p-4">
              <Sparkles className="size-5 shrink-0 text-pulse-600" strokeWidth={2} />
              <p className="text-sm text-pulse-900">
                <span className="font-semibold">Held safely</span> until your job is complete.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-md bg-muted/50 p-4">
              <p className="text-sm text-foreground">
                You&apos;ll pay {rupees(total > 0 ? total : 0)} cash directly to your garage when
                the job is done.
              </p>
            </div>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Free to cancel until 1 hour before your slot.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handleConfirm} loading={isPending} className="w-full">
          {mode === "upi" ? "Confirm & pay" : "Confirm booking"}
        </Button>
      </BottomCTA>
    </div>
  );
}

function PaymentOption({
  checked,
  onChange,
  title,
  subtitle,
  recommended,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={cn(
        "tap flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors active:scale-[0.99]",
        checked
          ? "border-primary bg-primary-soft"
          : "border-border bg-card hover:border-steel-300",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-primary" : "border-steel-300",
        )}
        aria-hidden
      >
        {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">{title}</span>
          {recommended ? (
            <span className="rounded-full bg-pulse-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-pulse-700">
              Recommended ✨
            </span>
          ) : null}
        </div>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
    </button>
  );
}
