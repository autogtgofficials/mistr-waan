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
import { PayNowButton } from "@/components/booking/PayNowButton";
import type { Booking } from "@/lib/bookings/types";
import { ownerLabel, rupees, cn } from "@/lib/utils";

interface PaymentSummary {
  id: string;
  status: "pending" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  capturedAt: string | null;
}

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
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "not_found" | "error">(
    "loading",
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pickedRating, setPickedRating] = useState<number | null>(null);
  const [pickedReason, setPickedReason] = useState<string | null>(null);

  // Initial load + polling for live status. Polls every 15s — Realtime would
  // be nicer (Week 5+) but polling is robust against missed events.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function loadOnce(isInitial: boolean) {
      try {
        const [bRes, pRes] = await Promise.all([
          fetch(`/api/bookings/${id}`, { credentials: "include" }),
          fetch(`/api/bookings/${id}/payment`, { credentials: "include" }).catch(
            () => null,
          ),
        ]);
        if (cancelled) return;
        if (bRes.status === 404) return setLoadState("not_found");
        if (!bRes.ok) {
          if (isInitial) setLoadState("error");
          return;
        }
        const bData = (await bRes.json()) as { booking: Booking };
        setBooking(bData.booking);
        if (pRes && pRes.ok) {
          const pData = (await pRes.json()) as { payment: PaymentSummary | null };
          setPayment(pData.payment);
        }
        setLoadState("loaded");
      } catch {
        if (isInitial && !cancelled) setLoadState("error");
      }
    }
    void loadOnce(true);
    const poll = () => {
      if (cancelled) return;
      void loadOnce(false).finally(() => {
        if (!cancelled) timer = setTimeout(poll, 15_000);
      });
    };
    timer = setTimeout(poll, 15_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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

  async function submitRating(comment?: string | null) {
    if (pickedRating === null || !booking) return;
    setRateBusy(true);
    setRateError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/rating`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: pickedRating,
          comment: comment ?? pickedReason ?? null,
        }),
      });
      const data = (await res.json()) as { booking?: Booking; error?: string };
      if (!res.ok || !data.booking) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setBooking(data.booking);
      setRateOpen(false);
      if (pickedRating <= 2 && !comment) setReasonOpen(true);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Rating failed");
    } finally {
      setRateBusy(false);
    }
  }

  async function doCancel() {
    if (!booking) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { booking?: Booking; error?: string };
      if (!res.ok || !data.booking) {
        const code = data.error ?? `HTTP ${res.status}`;
        // Translate the common server error codes to friendly copy.
        if (code.startsWith("cutoff_exceeded")) {
          throw new Error(
            "Less than 1 hour to your slot — please WhatsApp us if you need to cancel.",
          );
        }
        throw new Error(code);
      }
      setBooking(data.booking);
      setCancelOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelBusy(false);
    }
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

          {/* Pay Now — UPI booking, has a quote, no captured payment yet,
              and Razorpay is enabled. */}
          {booking.paymentMode === "upi" &&
          booking.total != null &&
          booking.total > 0 &&
          (booking.status === "quoted" || booking.status === "awaiting_garage") &&
          payment?.status !== "captured" &&
          process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true" ? (
            <div className="mt-6 rounded-md border border-pulse-100 bg-pulse-50 p-4">
              <h3 className="text-sm font-semibold text-pulse-900">
                Payment due: {rupees(booking.total)}
              </h3>
              <p className="mt-1 text-xs text-pulse-900">
                Pay now to lock in your slot.
              </p>
              <div className="mt-3">
                <PayNowButton
                  bookingId={booking.id}
                  amount={booking.total}
                  customerName={undefined}
                  onSuccess={() => {
                    // Trigger an immediate refresh after the modal closes.
                    setPayment((prev) =>
                      prev
                        ? { ...prev, status: "captured", capturedAt: new Date().toISOString() }
                        : prev,
                    );
                  }}
                />
              </div>
            </div>
          ) : null}

          {payment?.status === "captured" ? (
            <div className="mt-6 rounded-md border border-aqua-100 bg-aqua-50 p-4 text-sm text-aqua-900">
              UPI payment of {rupees(payment.amount)} received. Thank you!
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
                  Call {garage.ownerFirstName} via AutoGTG
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
        onClose={() => {
          if (!cancelBusy) {
            setCancelOpen(false);
            setCancelError(null);
          }
        }}
        title="Cancel this booking?"
        description="Free to cancel up to 1 hour before your slot."
      >
        <div className="flex flex-col gap-3 pt-2">
          {cancelError ? (
            <p className="rounded-md border border-ignite-100 bg-ignite-50 p-3 text-sm text-ignite-900">
              {cancelError}
            </p>
          ) : null}
          <Button
            variant="danger"
            loading={cancelBusy}
            onClick={() => void doCancel()}
          >
            Yes, cancel booking
          </Button>
          <Button
            variant="ghost"
            disabled={cancelBusy}
            onClick={() => setCancelOpen(false)}
          >
            Keep booking
          </Button>
        </div>
      </Sheet>

      {/* Rating sheet */}
      <Sheet
        open={rateOpen}
        onClose={() => {
          if (!rateBusy) {
            setRateOpen(false);
            setRateError(null);
          }
        }}
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
          {rateError ? (
            <p className="mt-2 text-sm text-danger">{rateError}</p>
          ) : null}
        </div>
        <Button
          onClick={() => void submitRating()}
          loading={rateBusy}
          disabled={pickedRating === null}
          className="w-full"
        >
          Submit rating
        </Button>
      </Sheet>

      {/* Bad-rating reason sheet — submits an updated rating with the comment.
          Backend allows a single rating per booking so this is the same row,
          but we display the reason in the audit log for ops. */}
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
                  void submitRating(r);
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
        <Button onClick={() => setReasonOpen(false)} variant="ghost" className="w-full">
          Skip
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
