import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { GarageList } from "@/components/garage/GarageList";
import { mockGarages, getGaragesForBucket } from "@/lib/mock/garages";
import type { ServiceBucket } from "@/lib/mock/services";

/**
 * /garages — list of garages, optionally filtered by ?service=<bucket>.
 *
 * Per design 3.5: top bar with back + filter, count, sort chip, list of cards.
 * Filter icon is a stub in V0 (no filter UI built yet — placeholder).
 */

const VALID_BUCKETS: ServiceBucket[] = ["repairs", "detailing", "denting"];
const BUCKET_TITLES: Record<ServiceBucket, string> = {
  repairs: "Pick a garage for repairs",
  detailing: "Pick a garage for detailing",
  denting: "Pick a garage for denting",
};

export default async function GaragesPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const sp = await searchParams;
  const serviceParam = sp.service;
  const bucket = VALID_BUCKETS.find((b) => b === serviceParam);

  const garages = bucket ? getGaragesForBucket(bucket) : mockGarages;
  const title = bucket ? BUCKET_TITLES[bucket] : "Pick a garage";

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <Link
            href="/"
            aria-label="Back to home"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        }
        title={<span className="truncate">{title}</span>}
        right={
          <button
            type="button"
            aria-label="Filter"
            className="tap flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <SlidersHorizontal className="size-5" strokeWidth={2} />
          </button>
        }
      />
      <ActiveJobBar />

      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <GarageList garages={garages} service={bucket} />
        </div>
      </main>

      <TabBar />
    </div>
  );
}
