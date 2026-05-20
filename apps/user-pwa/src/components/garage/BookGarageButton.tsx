"use client";

import { useRouter } from "next/navigation";
import { writeDraft, readDraft } from "@/lib/store/booking-draft";
import type { BookingBucket } from "@/lib/store/booking-draft";
import { Button } from "@/components/ui/Button";

/**
 * "Book this garage" CTA on the garage detail page.
 *
 * Writes the picked garageId into the draft, ensures the bucket is set,
 * and routes to the slot picker. If the user landed here without a
 * service bucket (e.g. direct deep link), default to "detailing" with
 * an empty service list so we still proceed gracefully.
 */
export function BookGarageButton({
  garageId,
  bucket,
}: {
  garageId: string;
  bucket?: BookingBucket;
}) {
  const router = useRouter();

  function handleBook() {
    const current = readDraft();
    const resolvedBucket = bucket ?? current.bucket ?? "detailing";
    writeDraft({
      bucket: resolvedBucket,
      garageId,
    });
    router.push("/booking/slot");
  }

  return (
    <Button onClick={handleBook} className="w-full" size="md">
      Book this garage
    </Button>
  );
}
