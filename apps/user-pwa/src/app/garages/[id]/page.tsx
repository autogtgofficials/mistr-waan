import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookGarageButton } from "@/components/garage/BookGarageButton";
import { getGarageById } from "@/lib/mock/garages";
import {
  detailingServices,
  type ServiceBucket,
  type ServiceItem,
} from "@/lib/mock/services";
import { getReviewsForGarage } from "@/lib/mock/reviews";
import {
  ownerLabel,
  approxKm,
  jobsDoneLabel,
  rupees,
  timeAgo,
} from "@/lib/utils";

/**
 * /garages/[id] — garage detail (per design 3.6).
 *
 * Reveals more about the garage than the list card (joined date, services
 * offered, recent reviews). Still no shop name, address, or phone — those
 * unlock only after a booking is confirmed.
 *
 * Sticky bottom CTA: "Book this garage".
 */

const VALID_BUCKETS: ServiceBucket[] = ["repairs", "detailing", "denting"];

export default async function GarageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const bucket = VALID_BUCKETS.find((b) => b === sp.service);
  const garage = getGarageById(id);

  if (!garage) notFound();

  const reviews = getReviewsForGarage(garage.id);
  const offered = servicesOfferedByGarage(garage.serviceBuckets, bucket);

  // "Joined" date is mocked — V1 uses Garage.joined_at.
  const joinedLabel = "Apr 2026";

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <Link
            href={bucket ? `/garages?service=${bucket}` : "/garages"}
            aria-label="Back to garages"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        }
        title={<span className="truncate">Garage details</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-24">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {/* Hero block */}
          <section className="flex items-center gap-4">
            <span
              className="flex size-20 items-center justify-center rounded-lg bg-pulse-100 text-pulse-700 text-xl font-semibold"
              aria-hidden
            >
              {(garage.ownerFirstName.charAt(0) + garage.ownerLastName.charAt(0)).toUpperCase()}
            </span>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-foreground">
                {ownerLabel(garage.ownerFirstName, garage.ownerLastName)}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{garage.area}</p>
              <p className="text-sm text-muted-foreground">{approxKm(garage.distanceKm)} from you</p>
            </div>
          </section>

          {/* Stats row */}
          <section className="mt-6 flex items-center gap-6">
            {garage.jobsCompleted > 0 ? (
              <div className="flex items-center gap-1.5">
                <Star className="size-5 fill-ignite-500 text-ignite-500" strokeWidth={1.5} />
                <span className="text-base font-semibold text-foreground">
                  {garage.rating.toFixed(1)}
                </span>
              </div>
            ) : null}
            <span className="text-sm text-muted-foreground">{jobsDoneLabel(garage.jobsCompleted)}</span>
            <span className="text-sm text-muted-foreground">Joined · {joinedLabel}</span>
          </section>

          {/* Services offered */}
          <Divider />
          <section>
            <h2 className="text-base font-semibold text-foreground">Services offered</h2>
            <ul className="mt-3 flex flex-col">
              {offered.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between border-b border-border-subtle py-3 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="text-base text-foreground">{s.name}</span>
                    {s.blurb ? (
                      <span className="text-xs text-muted-foreground">{s.blurb}</span>
                    ) : null}
                  </div>
                  <span className="tabular text-sm font-medium text-foreground">
                    {rupees(s.price)}
                  </span>
                </li>
              ))}
            </ul>
            {garage.serviceBuckets.includes("repairs") ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Also does repairs — price after inspection.
              </p>
            ) : null}
            {garage.serviceBuckets.includes("denting") ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Also does denting & painting — quote after photos.
              </p>
            ) : null}
          </section>

          {/* Reviews */}
          <Divider />
          <section>
            <h2 className="text-base font-semibold text-foreground">Recent reviews</h2>
            {reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                body="Be the first to rate this garage."
                className="px-0 py-6"
              />
            ) : (
              <ul className="mt-3 flex flex-col gap-4">
                {reviews.slice(0, 3).map((r) => (
                  <li key={r.id} className="rounded-md bg-muted/40 p-3">
                    <Stars rating={r.rating} />
                    <p className="mt-1.5 text-sm text-foreground">{r.comment}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      — {ownerLabel(r.reviewerFirstName, r.reviewerLastName)} ·{" "}
                      {timeAgo(r.ageDays)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {reviews.length > 3 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {reviews.length - 3} more review{reviews.length - 3 === 1 ? "" : "s"} —
                full listing arrives in V1.
              </p>
            ) : null}
          </section>
        </div>
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-md">
          <BookGarageButton garageId={garage.id} bucket={bucket} />
        </div>
      </div>

      <TabBar />
    </div>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
}

function servicesOfferedByGarage(
  buckets: ServiceBucket[],
  filter?: ServiceBucket,
): ServiceItem[] {
  // V0: only detailing items have explicit prices in mock; we surface those.
  // (Repairs/denting prices are deferred — call-out under the list explains.)
  if (filter && filter !== "detailing") return [];
  if (!buckets.includes("detailing")) return [];
  return detailingServices;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= rating
              ? "size-4 fill-ignite-500 text-ignite-500"
              : "size-4 text-steel-300"
          }
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}
