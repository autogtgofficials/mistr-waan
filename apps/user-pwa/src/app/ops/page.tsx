import Link from "next/link";
import { Phone } from "lucide-react";
import { NavBar } from "@/components/ops/NavBar";
import { MechanicList } from "@/components/ops/MechanicList";
import { getAllMechanics } from "@/lib/mechanics/data";
import { countBookingsByStatus } from "@/lib/bookings/ops-data";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string; service?: string }>;
}) {
  const [mechanics, params, queuedCalls] = await Promise.all([
    getAllMechanics(),
    searchParams,
    countBookingsByStatus("queued_for_call").catch(() => 0),
  ]);
  return (
    <>
      <NavBar total={mechanics.length} queuedCalls={queuedCalls} />
      <main className="flex-1">
        {queuedCalls > 0 ? (
          <div className="mx-auto max-w-6xl px-4 pt-4">
            <Link
              href="/ops/calls"
              className="flex items-center justify-between gap-4 rounded-md border border-ignite-200 bg-ignite-50 p-4 transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ignite-500 text-white">
                  <Phone className="size-5" strokeWidth={2} />
                </span>
                <div>
                  <p className="font-semibold text-ignite-900">
                    {queuedCalls} customer{queuedCalls === 1 ? "" : "s"} waiting for a call
                  </p>
                  <p className="text-sm text-ignite-800/80">
                    Work the calls-to-make queue →
                  </p>
                </div>
              </div>
            </Link>
          </div>
        ) : null}

        <MechanicList
          initial={mechanics}
          initialArea={params.area}
          initialStatus={params.status}
          initialService={params.service}
        />
      </main>
    </>
  );
}
