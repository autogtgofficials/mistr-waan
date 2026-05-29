import { redirect } from "next/navigation";
import Link from "next/link";
import { getOpsSession } from "@/lib/auth/session";
import {
  listGaragesByOnboardingStatus,
  type GarageOnboardingStatus,
} from "@/lib/garage/data";
import { OpsGaragesTable } from "./OpsGaragesTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: GarageOnboardingStatus[] = [
  "pending_verification",
  "active",
  "rejected",
  "suspended",
];

export default async function OpsGaragesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/garages");

  const { status: rawStatus } = await searchParams;
  const status = (
    rawStatus && VALID_STATUSES.includes(rawStatus as GarageOnboardingStatus)
      ? rawStatus
      : "pending_verification"
  ) as GarageOnboardingStatus;

  const garages = await listGaragesByOnboardingStatus(status);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <Link
              href="/ops/bookings"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Bookings
            </Link>
            <h1 className="text-lg font-semibold text-foreground mt-1">
              Ops · Garages
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">
            Signed in as {session.email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <OpsGaragesTable garages={garages} currentStatus={status} />
      </main>
    </div>
  );
}
