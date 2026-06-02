import { redirect } from "next/navigation";
import Link from "next/link";
import { getOpsSession } from "@/lib/auth/session";
import { listAllActiveServices } from "@/lib/services/catalog";
import { listActiveGarages } from "@/lib/garage/data";
import { OpsNewBookingForm } from "./OpsNewBookingForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /ops/bookings/new — the call-first capture form. When a customer calls in,
 * ops fills this to turn the call into a booking (upserts the customer's
 * profile by phone + creates the booking). The customer can then log in with
 * that number to track + pay.
 */
export default async function OpsNewBookingPage() {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/bookings/new");

  const [services, garages] = await Promise.all([
    listAllActiveServices(),
    listActiveGarages(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <Link href="/ops/bookings" className="text-sm text-muted-foreground hover:underline">
              ← Bookings
            </Link>
            <h1 className="text-lg font-semibold text-foreground mt-1">
              New booking (from call)
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">Signed in as {session.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6">
        <OpsNewBookingForm
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            bucket: s.bucket,
            isQuoted: s.isQuoted,
            basePrice: s.basePrice,
          }))}
          garages={garages.map((g) => ({
            id: g.id,
            label: `${g.shopName} — ${g.area}`,
            serviceBuckets: g.serviceBuckets,
          }))}
        />
      </main>
    </div>
  );
}
