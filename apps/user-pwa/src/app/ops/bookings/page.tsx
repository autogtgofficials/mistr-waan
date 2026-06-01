import { redirect } from "next/navigation";
import Link from "next/link";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsBookings, type ListOpsBookingsOpts } from "@/lib/bookings/ops-data";
import { OpsBookingsTable } from "./OpsBookingsTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpsBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; bucket?: string }>;
}) {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/bookings");

  const { status: statusRaw, bucket: bucketRaw } = await searchParams;

  const bookings = await listOpsBookings({
    status: statusRaw as ListOpsBookingsOpts["status"],
    bucket: bucketRaw as ListOpsBookingsOpts["bucket"],
    limit: 200,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-foreground">Ops · Bookings</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/ops/garages"
              className="text-sm text-muted-foreground hover:underline"
            >
              Garages
            </Link>
            <Link
              href="/ops/bookings/new"
              className="rounded-md bg-pulse-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              + New booking
            </Link>
            <span className="text-sm text-muted-foreground">{session.email}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <OpsBookingsTable
          bookings={bookings}
          currentStatus={statusRaw ?? "all"}
          currentBucket={bucketRaw ?? "all"}
        />
      </main>
    </div>
  );
}
