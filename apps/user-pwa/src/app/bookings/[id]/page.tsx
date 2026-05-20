"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Star,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill } from "@/components/booking/StatusPill";
import { useJobs } from "@/lib/store/jobs";
import { getGarageById } from "@/lib/mock/garages";
import { ownerLabel, rupees, cn } from "@/lib/utils";

/**
 * /bookings/[id] — live tracking + post-completion rating.
 *
 * Mock V0: includes "advance status" buttons so the demo can walk through
 * assigned → in_progress → completed without a real backend.
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
  const { jobs, hydrated, update, cancel } = useJobs();
  const job = jobs.find((j) => j.id === id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pickedRating, setPickedRating] = useState<number | null>(null);
  const [pickedReason, setPickedReason] = useState<string | null>(null);

  if (!hydrated) return <div className="flex min-h-full" />;
  if (!job) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Booking not found</h1>
        <Link href="/bookings" className="mt-3 text-sm text-primary underline">
          Back to bookings
        </Link>
      </div>
    );
  }

  const garage = getGarageById(job.garageId);
  if (!garage) return <div className="flex min-h-full" />;

  const directionsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    garage.fullAddress,
  )}`;

  function submitRating() {
    if (pickedRating === null) return;
    update(job!.id, { rating: pickedRating as 1 | 2 | 3 | 4 | 5 });
    setRateOpen(false);
    if (pickedRating <= 2) setReasonOpen(true);
  }

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
            <StatusPill status={job.status} />
            <h1 className="mt-3 text-2xl font-bold text-foreground">
              {job.status === "assigned"
                ? "Booked & confirmed"
                : job.status === "in_progress"
                  ? "Job in progress"
                  : job.status === "completed"
                    ? "Job completed"
                    : "Booking cancelled"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{job.slotLabel}</p>
          </div>

          {/* State-specific helper */}
          {job.status === "assigned" ? (
            <div className="mt-6 rounded-md bg-pulse-50 border border-pulse-100 p-4 text-sm text-pulse-900">
              You&apos;ll get a WhatsApp ping when {garage.ownerFirstName} starts the job.
            </div>
          ) : job.status === "in_progress" ? (
            <div className="mt-6 rounded-md bg-orange-50 border border-orange-100 p-4 text-sm text-ignite-900">
              {garage.ownerFirstName} is working on your car right now.
            </div>
          ) : job.status === "completed" ? (
            <div className="mt-6 flex flex-col gap-3 rounded-md bg-aqua-50 border border-aqua-100 p-4">
              <p className="text-sm text-aqua-900">
                {job.rating
                  ? `Thanks for rating! You gave ${job.rating}★.`
                  : `Tell us how it went — your rating helps other users.`}
              </p>
              {!job.rating ? (
                <Button onClick={() => setRateOpen(true)} size="sm" inline>
                  Rate {garage.ownerFirstName}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-md bg-muted p-4 text-sm text-muted-foreground">
              This booking was cancelled.
            </div>
          )}

          <Divider />

          {/* Garage block */}
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

          {job.status !== "cancelled" ? (
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

          {/* Mock-state controls — V0 demo only. */}
          <Section title="Demo controls">
            <p className="text-xs text-muted-foreground">
              These exist for the V0 demo only. With backend wired, the garage drives status.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {job.status === "assigned" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  inline
                  onClick={() => update(job.id, { status: "in_progress" })}
                >
                  Mark as in progress
                </Button>
              ) : null}
              {job.status === "in_progress" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  inline
                  onClick={() => update(job.id, { status: "completed" })}
                >
                  Mark as completed
                </Button>
              ) : null}
              {job.status === "assigned" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  inline
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel booking
                </Button>
              ) : null}
            </div>
          </Section>

          <Divider />

          <section className="text-xs text-muted-foreground">
            <p className="tabular">Booking ID: {job.id}</p>
            <p>
              {job.paymentMode === "upi"
                ? `Paid: ${rupees(job.total)} via UPI`
                : `Pay ${rupees(job.total)} cash on completion`}
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
              cancel(job.id);
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
        title={`How was ${garage.ownerFirstName}?`}
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

      {/* Bad-rating reason sheet (locked Q9 = a) */}
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
                  className={cn(
                    "size-5 rounded-full border-2",
                    pickedReason === r ? "border-primary bg-primary" : "border-steel-300",
                  )}
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
