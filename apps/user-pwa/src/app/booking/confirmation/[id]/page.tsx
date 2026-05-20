"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TabBar } from "@/components/layout/TabBar";
import { useJobs } from "@/lib/store/jobs";
import { getGarageById } from "@/lib/mock/garages";
import { detailingServices } from "@/lib/mock/services";
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
  const { jobs, hydrated } = useJobs();
  const job = jobs.find((j) => j.id === id);
  const [callSheetOpen, setCallSheetOpen] = useState(false);

  /* Fade-in check icon on mount */
  const [showCheck, setShowCheck] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowCheck(true), 50);
    return () => clearTimeout(t);
  }, []);

  const garage = useMemo(
    () => (job ? getGarageById(job.garageId) : undefined),
    [job],
  );
  const services = useMemo(
    () =>
      (job?.serviceIds ?? [])
        .map((sid) => detailingServices.find((s) => s.id === sid))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [job],
  );

  if (!hydrated) return <div className="flex min-h-full" />;
  if (!job || !garage) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Booking not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This booking may have expired or is on a different device.
        </p>
        <Link href="/" className="mt-4 text-sm text-primary underline">
          Back to home
        </Link>
      </div>
    );
  }

  const directionsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    garage.fullAddress,
  )}`;

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
            <h1 className="mt-3 text-2xl font-bold text-primary">Booking confirmed</h1>
            <p className="mt-2 text-base text-foreground">{job.slotLabel}</p>
          </div>

          <Divider />

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

          {services.length > 0 ? (
            <Section title="Services">
              <ul className="flex flex-col gap-2">
                {services.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between">
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="tabular text-sm font-medium text-foreground">
                      {rupees(s.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Divider />

          <section className="text-sm text-muted-foreground">
            <p className="tabular">Booking ID: {job.id}</p>
            <p className="mt-1">
              {job.paymentMode === "upi"
                ? `Paid: ${rupees(job.total)} via UPI`
                : `Pay ${rupees(job.total)} cash on completion`}
            </p>
          </section>

          <Divider />

          <section className="text-sm">
            <p className="text-muted-foreground">Free to cancel up to 1 hour before slot.</p>
            <Link
              href={`/bookings/${job.id}`}
              className="mt-2 inline-flex text-primary font-medium underline-offset-2 hover:underline"
            >
              Track this booking →
            </Link>
          </section>
        </div>
      </main>

      <TabBar />

      {callSheetOpen ? (
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
