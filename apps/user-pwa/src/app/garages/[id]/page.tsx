import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookGarageButton } from "@/components/garage/BookGarageButton";
import { getGarageById } from "@/lib/garage/data";
import { getReviewsByGarage } from "@/lib/bookings/ratings";
import type { BookingBucket } from "@/lib/store/booking-draft";
import { ownerLabel, jobsDoneLabel, timeAgo } from "@/lib/utils";

/**
 * /garages/[id] — public garage detail. Real garage row + real reviews from the
 * ratings table. Still no shop name, address, or phone — those unlock only after
 * a booking is confirmed. Sticky CTA: "Book this garage" (sets the pick).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_BUCKETS: BookingBucket[] = ["repairs", "detailing", "denting"];
const BUCKET_LABEL: Record<string, string> = {
  repairs: "Repairs",
  detailing: "Detailing",
  denting: "Denting & painting",
};

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

  const garage = await getGarageById(id);
  if (!garage || !garage.active) notFound();

  const reviews = await getReviewsByGarage(garage.id, 5);

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
              {garage.workingHours ? (
                <p className="text-sm text-muted-foreground">{garage.workingHours}</p>
              ) : null}
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
            <span className="text-sm text-muted-foreground">
              {jobsDoneLabel(garage.jobsCompleted)}
            </span>
          </section>

          {/* What they do */}
          <Divider />
          <section>
            <h2 className="text-base font-semibold text-foreground">What they do</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {garage.serviceBuckets.map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-pulse-50 px-3 py-1 text-sm font-medium text-pulse-700"
                >
                  {BUCKET_LABEL[b] ?? b}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Final price is confirmed on the call after you book.
            </p>
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
                {reviews.map((r) => {
                  const days = Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000,
                    ),
                  );
                  return (
                    <li key={r.id} className="rounded-md bg-muted/40 p-3">
                      <Stars rating={r.score} />
                      {r.comment ? (
                        <p className="mt-1.5 text-sm text-foreground">{r.comment}</p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        — {r.reviewerFirstName ?? "Verified customer"} · {timeAgo(days)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-md">
          <BookGarageButton
            garageId={garage.id}
            garageLabel={ownerLabel(garage.ownerFirstName, garage.ownerLastName)}
            bucket={bucket}
          />
        </div>
      </div>

      <TabBar />
    </div>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
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
