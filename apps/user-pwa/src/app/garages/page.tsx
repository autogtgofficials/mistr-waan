import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { GarageList } from "@/components/garage/GarageList";
import { listActiveGaragesByBucket } from "@/lib/garage/data";
import { toGarageSummary } from "@/lib/garage/summary";

/**
 * /garages — real, active garages, optionally filtered by ?service=<bucket>.
 *
 * Browse-and-pick surface: the customer can choose a preferred garage (the
 * pick rides into the booking as a hint; ops can still override). Shop name /
 * address / phone stay hidden until the booking is confirmed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_BUCKETS = ["repairs", "detailing", "denting"] as const;
const BUCKET_TITLES: Record<string, string> = {
  repairs: "Pick a garage for repairs",
  detailing: "Pick a garage for detailing",
  denting: "Pick a garage for denting",
};

export default async function GaragesPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; book?: string }>;
}) {
  const sp = await searchParams;
  const bucket = VALID_BUCKETS.find((b) => b === sp.service);
  const inBooking = sp.book === "1";

  const garages = (await listActiveGaragesByBucket(bucket)).map(toGarageSummary);
  const title = bucket ? BUCKET_TITLES[bucket] : "Pick a garage";

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <Link
            href="/services"
            aria-label="Back"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        }
        title={<span className="truncate">{title}</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          {inBooking ? (
            <div className="mb-5">
              <Link
                href="/booking/request"
                className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
              >
                Let AutoGTG pick the best garage →
              </Link>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                or choose a garage yourself below
              </p>
            </div>
          ) : null}

          <GarageList garages={garages} service={bucket} />
        </div>
      </main>

      <TabBar />
    </div>
  );
}
