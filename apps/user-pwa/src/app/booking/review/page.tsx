"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { useAuth } from "@/lib/store/auth";
import { getGarageById } from "@/lib/mock/garages";
import { detailingServices } from "@/lib/mock/services";
import { ownerLabel, rupees, approxKm } from "@/lib/utils";

/**
 * /booking/review — last confirmation before payment.
 *
 * Shows services + garage + slot + total with [Edit] links per section.
 * Tap Continue → if not signed in, redirect to /login?next=/booking/pay.
 */
export default function BookingReviewPage() {
  const router = useRouter();
  const { draft, hydrated } = useBookingDraft();
  const { isAuthed, hydrated: authHydrated } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!draft.garageId || !draft.slot) router.replace("/");
  }, [hydrated, draft.garageId, draft.slot, router]);

  const garage = draft.garageId ? getGarageById(draft.garageId) : undefined;
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

  if (!hydrated || !garage || !draft.slot) {
    return <div className="flex min-h-full" />;
  }

  function handleContinue() {
    if (!authHydrated) return;
    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent("/booking/pay")}`);
      return;
    }
    router.push("/booking/pay");
  }

  const editServicesHref =
    draft.bucket === "repairs"
      ? "/repairs"
      : draft.bucket === "denting"
        ? "/denting"
        : "/detailing";

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
        title={<span>Review your booking</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {/* Services */}
          {services.length > 0 ? (
            <Section
              title="Services"
              editHref={editServicesHref}
              editLabel="Edit"
            >
              <ul className="flex flex-col gap-2">
                {services.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between">
                    <span className="text-base text-foreground">{s.name}</span>
                    <span className="tabular text-base font-medium text-foreground">
                      {rupees(s.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <Section title="Service" editHref={editServicesHref} editLabel="Edit">
              <p className="text-sm text-muted-foreground">
                {draft.bucket === "repairs"
                  ? "Repairs — price after garage inspection."
                  : draft.bucket === "denting"
                    ? "Denting & painting — quote after photos."
                    : "Service details"}
              </p>
            </Section>
          )}

          <Divider />

          {/* Garage */}
          <Section
            title="Garage"
            editHref={`/garages?service=${draft.bucket ?? "detailing"}`}
            editLabel="Edit"
          >
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
                <span className="text-sm text-muted-foreground">
                  {garage.area} · {approxKm(garage.distanceKm)}
                </span>
                <span className="text-sm text-foreground">★ {garage.rating.toFixed(1)}</span>
              </div>
            </div>
          </Section>

          <Divider />

          {/* Slot */}
          <Section title="Slot" editHref="/booking/slot" editLabel="Edit">
            <p className="text-base text-foreground">{draft.slot.label}</p>
          </Section>

          <Divider />

          {/* Total */}
          {services.length > 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="tabular text-2xl font-bold text-foreground">
                {rupees(total)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Final price will be set by the garage.
            </p>
          )}
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handleContinue} className="w-full">
          Continue to pay ›
        </Button>
      </BottomCTA>
    </div>
  );
}

function Section({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string;
  editHref: string;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <Link
          href={editHref}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {editLabel}
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
}
