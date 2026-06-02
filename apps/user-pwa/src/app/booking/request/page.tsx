"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import {
  useBookingDraft,
  clearDraft,
  type BookingBucket,
} from "@/lib/store/booking-draft";
import { useAuth } from "@/lib/store/auth";
import { detailingServices } from "@/lib/mock/services";
import { rupees } from "@/lib/utils";

/**
 * /booking/request — the single "Confirm booking" step.
 *
 * Replaces the old garage → slot → review → pay funnel. The customer has
 * already picked what they need; here they just sign in (if needed) and tap
 * Confirm. We create the booking in `queued_for_call` with no slot and no
 * payment — ops rings them back to lock the details. No money changes hands
 * until after that call.
 */

const BUCKET_LABEL: Record<BookingBucket, string> = {
  detailing: "Detailing",
  repairs: "Repairs",
  denting: "Denting & painting",
};

const BUCKET_BLURB: Record<BookingBucket, string> = {
  detailing: "We'll confirm timing and your garage on the call.",
  repairs: "Tell us what's wrong on the call — we'll arrange the right mechanic.",
  denting: "We'll arrange photos over WhatsApp and quote after the call.",
};

export default function BookingRequestPage() {
  const router = useRouter();
  const { draft, hydrated } = useBookingDraft();
  const { isAuthed, hydrated: authHydrated, user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Auth gate + draft guard. Login bounces back here via ?next=/booking/request,
  // and the draft survives in sessionStorage across that round-trip.
  useEffect(() => {
    if (!hydrated || !authHydrated) return;
    if (!isAuthed) {
      router.replace(`/login?next=${encodeURIComponent("/booking/request")}`);
      return;
    }
    if (!draft.bucket) router.replace("/book");
  }, [hydrated, authHydrated, isAuthed, draft.bucket, router]);

  const services = useMemo(
    () =>
      (draft.serviceIds ?? [])
        .map((id) => detailingServices.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [draft.serviceIds],
  );
  const total = useMemo(
    () => services.reduce((acc, s) => acc + s.price, 0),
    [services],
  );

  if (!hydrated || !authHydrated || !isAuthed || !draft.bucket) {
    return <div className="flex min-h-full" />;
  }

  const bucket = draft.bucket;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bucket,
            serviceIds: draft.serviceIds ?? [],
            // User's garage pick (if they browsed) is only a hint — ops assigns.
            garageId: draft.garageId ?? null,
            symptoms: draft.symptoms ?? null,
            denting: draft.denting ?? null,
          }),
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.replace(
              `/login?next=${encodeURIComponent("/booking/request")}`,
            );
            return;
          }
          if (res.status === 429) {
            setError("You've placed a few bookings already. Try again later.");
            return;
          }
          setError("Couldn't place your booking. Please try again.");
          return;
        }

        const data = (await res.json()) as { booking: { shortId: string } };
        clearDraft();
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
        title={<span>Confirm booking</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">
            Book {BUCKET_LABEL[bucket]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {BUCKET_BLURB[bucket]}
          </p>

          {/* Selected services (Detailing) — otherwise a one-line summary. */}
          {services.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Services
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between"
                  >
                    <span className="text-base text-foreground">{s.name}</span>
                    <span className="tabular text-base font-medium text-foreground">
                      {rupees(s.price)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-3">
                <span className="text-base font-semibold text-foreground">
                  Estimated total
                </span>
                <span className="tabular text-xl font-bold text-foreground">
                  {rupees(total)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Final price confirmed on the call.
              </p>
            </section>
          ) : null}

          {/* What happens next */}
          <div className="mt-6 flex items-start gap-3 rounded-md bg-pulse-50 border border-pulse-100 p-4">
            <Phone className="size-5 shrink-0 text-pulse-600" strokeWidth={2} />
            <div className="text-sm text-pulse-900">
              <p className="font-semibold">We&apos;ll call you to confirm.</p>
              <p className="mt-1">
                No payment now. Our team rings you in a few minutes to lock the
                price, timing, and mechanic.
                {user?.phone ? (
                  <>
                    {" "}
                    We&apos;ll call{" "}
                    <span className="tabular font-medium">{user.phone}</span>.
                  </>
                ) : null}
              </p>
            </div>
          </div>

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
          Confirm booking
        </Button>
      </BottomCTA>
    </div>
  );
}
