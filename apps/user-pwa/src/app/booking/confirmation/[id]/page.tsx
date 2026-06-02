"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TabBar } from "@/components/layout/TabBar";
import { PhotoUploader } from "@/components/booking/PhotoUploader";
import type { Booking } from "@/lib/bookings/types";
import { ownerLabel, rupees } from "@/lib/utils";

/**
 * /booking/confirmation/[id] — the unlock moment.
 *
 * Address, shop name, "Get directions" link, and masked-call CTA are
 * revealed for the first time here.
 */
export default function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "not_found" | "error">(
    "loading",
  );
  const [callSheetOpen, setCallSheetOpen] = useState(false);

  /* Fade-in check icon on mount */
  const [showCheck, setShowCheck] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowCheck(true), 50);
    return () => clearTimeout(t);
  }, []);

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
        <p className="mt-1 text-sm text-muted-foreground">
          This booking may have been removed or you don&apos;t have access to it.
        </p>
        <Link href="/" className="mt-4 text-sm text-primary underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Couldn&apos;t load your booking right now. Try refreshing.
        </p>
      </div>
    );
  }

  const garage = booking.garage;
  const services = booking.services ?? [];

  const directionsHref = garage
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(garage.fullAddress)}`
    : "#";

  return (
    <div className="flex min-h-full flex-col bg-background">
      <main className="flex-1 pb-24">
        <div className="mx-auto w-full max-w-md px-4 pt-10">
          <div className="flex flex-col items-center text-center">
            <CheckCircle2
              className={`size-16 text-primary transition-all duration-500 ${
                showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
              strokeWidth={1.5}
            />
            <h1 className="mt-3 text-2xl font-bold text-primary">
              {booking.status === "queued_for_call"
                ? "Booking received"
                : "Booking confirmed"}
            </h1>
            <p className="mt-2 text-base text-foreground">{booking.slotLabel}</p>
            {booking.status === "queued_for_call" ? (
              <p className="mt-3 rounded-md bg-pulse-50 border border-pulse-100 p-3 text-sm text-pulse-900">
                We&apos;ll call you in a few minutes to confirm the details and final quote.
              </p>
            ) : null}
          </div>

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
                    {/* Shop name is REVEALED post-confirmation */}
                    <span className="text-sm text-foreground">{garage.shopName}</span>
                    <span className="text-sm text-muted-foreground">{garage.area}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/40 p-3">
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

              <Section title="Talk to your garage">
                <Button onClick={() => setCallSheetOpen(true)} className="w-full">
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
          ) : (
            <>
              <Section title="Next step">
                <p className="text-sm text-foreground">
                  Our team will pick the best-fit garage after speaking with you and assign it
                  to your booking shortly.
                </p>
              </Section>
              <Divider />
            </>
          )}

          {(booking.bucket === "repairs" || booking.bucket === "denting") && (
            <>
              <Section title="Photos">
                <p className="mb-3 text-sm text-muted-foreground">
                  Send a few clear photos of the damage so our team can quote accurately
                  before they call you.
                </p>
                <PhotoUploader bookingId={booking.id} />
              </Section>
              <Divider />
            </>
          )}

          {services.length > 0 ? (
            <>
              <Section title="Services">
                <ul className="flex flex-col gap-2">
                  {services.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between">
                      <span className="text-sm text-foreground">{s.name}</span>
                      <span className="tabular text-sm font-medium text-foreground">
                        {s.isQuoted ? "On inspection" : rupees(s.basePrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Divider />
            </>
          ) : null}

          <section className="text-sm text-muted-foreground">
            <p className="tabular">Booking ID: {booking.shortId}</p>
            <p className="mt-1">
              {(booking.total ?? booking.baseTotal ?? 0) > 0
                ? booking.paymentMode === "upi"
                  ? `Paid: ${rupees(booking.total ?? 0)} via UPI`
                  : `Pay ${rupees(booking.total ?? booking.baseTotal ?? 0)} cash on completion`
                : "No payment now — we'll confirm the price on the call."}
            </p>
          </section>

          <Divider />

          <section className="text-sm">
            <p className="text-muted-foreground">Free to cancel up to 1 hour before slot.</p>
            <Link
              href={`/bookings/${booking.shortId}`}
              className="mt-2 inline-flex text-primary font-medium underline-offset-2 hover:underline"
            >
              Track this booking →
            </Link>
          </section>
        </div>
      </main>

      <TabBar />

      {callSheetOpen && garage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => setCallSheetOpen(false)}
          role="dialog"
          aria-modal
        >
          <div
            className="rounded-lg bg-card p-6 max-w-sm shadow-lg text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="mx-auto size-10 text-primary" strokeWidth={1.5} />
            <h3 className="mt-3 text-lg font-bold text-foreground">Connecting…</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              In V0 demo, real call routing is mocked. Live calls go through Exotel masked DIDs.
            </p>
            <Button
              onClick={() => setCallSheetOpen(false)}
              variant="ghost"
              className="mt-4"
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
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
