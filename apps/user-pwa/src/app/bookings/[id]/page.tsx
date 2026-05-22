"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, MessageCircle, MapPin, Star } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill } from "@/components/booking/StatusPill";
import type { Booking } from "@/lib/bookings/types";
import { ownerLabel, rupees, cn } from "@/lib/utils";

/**
 * /bookings/[id] — live tracking + post-completion rating.
 *
 * Reads from `GET /api/bookings/[id]` (accepts UUID or short_id).
 * Mutations (cancel, rate) are currently optimistic-only — the matching
 * endpoints land in Week 3 (cancel) and Week 4 (rating).
 */

const RATING_REASONS = [
  "Quality was bad",
  "Took too long",
  "Was overcharged",
  "Behaviour issue",
  "Tried to take work outside the app",
  "Other",
];

export default function BookingTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "not_found" | "error">(
    "loading",
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pickedRating, setPickedRating] = useState<number | null>(null);
  const [, setPickedReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/bookings/${id}`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 404) return setLoadState("not_found");
        if (!res.ok) return setLoadState("error");
        const data = (await res.json()) as { booking: Booking };
        setBooking(data.booking);
        setLoadState("loaded");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadState === "loading") return <div className="flex min-h-full" />;
  if (loadState === "not_found" || !booking) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Booking not found</h1>
        <Link href="/bookings" className="mt-3 text-sm text-primary underline">
          Back to bookings
        </Link>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Couldn&apos;t load booking</h1>
        <p className="mt-2 text-sm text-muted-foreground">Refresh to try again.</p>
      </div>
    );
  }

  const garage = booking.garage ?? null;
  const directionsHref = garage
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(garage.fullAddress)}`
    : "#";

  function submitRating() {
    if (pickedRating === null) return;
    // TODO Week 4: POST /api/bookings/[id]/rating. Optimistic for now.
    setBooking((prev) =>
      prev ? { ...prev, ratingValue: pickedRating as 1 | 2 | 3 | 4 | 5 } : prev,
    );
    setRateOpen(false);
    if (pickedRating <= 2) setReasonOpen(true);
  }

  function optimisticCancel() {
    // TODO Week 3: PATCH /api/bookings/[id]/cancel. Optimistic for now.
    setBooking((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
  }

  const statusLine =
    booking.status === "queued_for_call"
      ? "We'll call you in a few minutes to confirm the quote."
      : booking.status === "quoted"
        ? "Quote ready — please confirm to proceed."
        : booking.status === "awaiting_garage"
          ? "Finding a garage for you."
          : booking.status === "assigned"
            ? `You'll get a WhatsApp ping when ${garage?.ownerFirstName ?? "your garage"} starts the job.`
            : booking.status === "in_progress"
              ? `${garage?.ownerFirstName ?? "Your garage"} is working on your car right now.`
              : booking.status === "completed"
                ? null
                : booking.status === "declined_by_garage"
                  ? "We're finding you another garage — back in a few minutes."
                  : "This booking was cancelled.";

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <button
            onClick={() => router.push("/bookings")}
            aria-label="Back"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </button>
        }
        title={<span>Track booking</span>}
      />

      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {/* Status hero */}
          <div className="flex flex-col items-center text-center">
            <StatusPill status={booking.status} />
            <h1 className="mt-3 text-2xl font-bold text-foreground">
              {booking.status === "queued_for_call"
                ? "Booking received"
                : booking.status === "quoted"
                  ? "Quote ready"
                  : booking.status === "awaiting_garage"
                    ? "Finding a garage"
                    : booking.status === "assigned"
                      ? "Booked & confirmed"
                      : booking.status === "in_progress"
                        ? "Job in progress"
                        : booking.status === "completed"
                          ? "Job completed"
                          : booking.status === "declined_by_garage"
                            ? "Reassigning"
                            : "Booking cancelled"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{booking.slotLabel}</p>
          </div>

          {/* State-specific helper */}
          {statusLine ? (
            <div
              className={cn(
                "mt-6 rounded-md border p-4 text-sm",
                booking.status === "in_progress"
                  ? "bg-orange-50 border-orange-100 text-ignite-900"
                  : booking.status === "cancelled"
                    ? "bg-muted text-muted-foreground"
                    : "bg-pulse-50 border-pulse-100 text-pulse-900",
              )}
            >
              {statusLine}
            </div>
          ) : null}

          {booking.status === "completed" ? (
            <div className="mt-6 flex flex-col gap-3 rounded-md bg-aqua-50 border border-aqua-100 p-4">
              <p className="text-sm text-aqua-900">
                {booking.ratingValue
                  ? `Thanks for rating! You gave ${booking.ratingValue}★.`
                  : "Tell us how it went — your rating helps other users."}
              </p>
              {!booking.ratingValue ? (
                <Button onClick={() => setRateOpen(true)} size="sm" inline>
                  Rate {garage?.ownerFirstName ?? "your garage"}
                </Button>
              ) : null}
            </div>
          ) : null}

          <Divider />

          {garage ? (
            <>
              <Section title="Garage">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-12 items-center justify-center rounded-md bg-pulse-100 text-pulse-700 text-sm font-semibold"
                    aria-hidden
                  >
                    {(garage.ownerFirstName.charAt(0) + garage.ownerLastName.charAt(0)).toUpperCase()}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-foreground">
                      {ownerLabel(garage.ownerFirstName, garage.ownerLastName)}
                    </span>
                    <span className="text-sm text-foreground">{garage.shopName}</span>
                    <span className="text-sm text-muted-foreground">{garage.area}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/40 p-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-foreground" strokeWidth={2} />
                  <span className="text-sm text-foreground">{garage.fullAddress}</span>
                </div>
                <a
                  href={directionsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Get directions →
                </a>
              </Section>

              <Divider />
            </>
          ) : null}

          {booking.status !== "cancelled" && garage ? (
            <>
              <Section title="Talk to your garage">
                <Button className="w-full">
                  <Phone className="size-4" strokeWidth={2} />
                  Call {garage.ownerFirstName} via Mister Waan
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">Your number stays private.</p>
                <button
                  type="button"
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <MessageCircle className="size-4" strokeWidth={2} />
                  WhatsApp us (need help?)
                </button>
              </Section>
              <Divider />
            </>
          ) : null}

          {(booking.status === "queued_for_call" ||
            booking.status === "quoted" ||
            booking.status === "awaiting_garage" ||
            booking.status === "assigned") && (
            <Section title="Booking actions">
              <Button
                size="sm"
                variant="ghost"
                inline
                onClick={() => setCancelOpen(true)}
              >
                Cancel booking
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Free to cancel up to 1 hour before your slot.
              </p>
            </Section>
          )}

          <Divider />

          <section className="text-xs text-muted-foreground">
            <p className="tabular">Booking ID: {booking.shortId}</p>
            <p>
              {booking.paymentMode === "upi"
                ? booking.total
                  ? `Paid: ${rupees(booking.total)} via UPI`
                  : "UPI — quote pending"
                : booking.total
                  ? `Pay ${rupees(booking.total)} cash on completion`
                  : "Cash on completion — quote pending"}
            </p>
          </section>
        </div>
      </main>

      <TabBar />

      {/* Cancel sheet */}
      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this booking?"
        description="Free to cancel up to 1 hour before your slot."
      >
        <div className="flex flex-col gap-3 pt-2">
          <Button
            variant="danger"
            onClick={() => {
              optimisticCancel();
              setCancelOpen(false);
            }}
          >
            Yes, cancel booking
          </Button>
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>
            Keep booking
          </Button>
        </div>
      </Sheet>

      {/* Rating sheet */}
      <Sheet
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title={`How was ${garage?.ownerFirstName ?? "your garage"}?`}
      >
        <div className="flex flex-col items-center gap-2 pt-4 pb-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPickedRating(n)}
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                className="tap"
              >
                <Star
                  className={cn(
                    "size-10 transition-transform",
                    pickedRating !== null && n <= pickedRating
                      ? "fill-ignite-500 text-ignite-500 scale-110"
                      : "text-steel-300",
                  )}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {pickedRating ? `${pickedRating} star${pickedRating === 1 ? "" : "s"}` : "Tap to rate"}
          </p>
        </div>
        <Button
          onClick={submitRating}
          disabled={pickedRating === null}
          className="w-full"
        >
          Submit rating
        </Button>
      </Sheet>

      {/* Bad-rating reason sheet */}
      <Sheet
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        title="What went wrong?"
        description="Helps us decide which garages to keep."
      >
        <ul className="flex flex-col pt-2 pb-3">
          {RATING_REASONS.map((r) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => {
                  setPickedReason(r);
                  setReasonOpen(false);
                }}
                className="tap flex w-full items-center justify-between rounded-md py-3 text-left active:bg-muted"
              >
                <span className="text-base text-foreground">{r}</span>
                <span
                  className="size-5 rounded-full border-2 border-steel-300"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
        <Button onClick={() => setReasonOpen(false)} className="w-full">
          Done
        </Button>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
}
