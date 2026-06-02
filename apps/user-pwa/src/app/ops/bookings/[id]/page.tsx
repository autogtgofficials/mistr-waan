import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById, getBookingByShortId } from "@/lib/bookings/data";
import { isValidShortId } from "@/lib/supabase/short-id";
import { listBookingPhotos, signPhotoUrls } from "@/lib/bookings/photos";
import { listBookingNotes } from "@/lib/bookings/notes";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { rupees } from "@/lib/utils";
import { OpsBookingActions } from "./OpsBookingActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GarageOpt = Pick<
  Database["public"]["Tables"]["garages"]["Row"],
  "id" | "slug" | "shop_name" | "area" | "owner_first_name" | "owner_last_name"
> & { service_buckets: string[] };

export default async function OpsBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/bookings");
  const { id } = await params;

  const booking = UUID_RE.test(id)
    ? await getBookingById(id)
    : isValidShortId(id)
      ? await getBookingByShortId(id)
      : null;
  if (!booking) notFound();

  // Server-side fan-out: profile, photos, notes, garage candidates (by-bucket
  // for the smart default, and all-active for manual override).
  const supabase = getSupabaseAdmin();
  const [{ data: profile }, photos, notes, { data: garageOpts }, { data: allGarageOpts }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("phone, first_name")
        .eq("id", booking.profileId)
        .maybeSingle(),
      listBookingPhotos(booking.id),
      listBookingNotes(booking.id).catch(() => []), // notes table may not yet exist on first deploy
      supabase
        .from("garages")
        .select("id, slug, shop_name, area, owner_first_name, owner_last_name, service_buckets")
        .eq("active", true)
        .contains("service_buckets", [booking.bucket])
        .order("rating", { ascending: false })
        .limit(50)
        .returns<GarageOpt[]>(),
      supabase
        .from("garages")
        .select("id, slug, shop_name, area, owner_first_name, owner_last_name, service_buckets")
        .eq("active", true)
        .order("area")
        .order("shop_name")
        .limit(300)
        .returns<GarageOpt[]>(),
    ]);

  const signedPhotos = await signPhotoUrls(photos);
  const garageOptions = garageOpts ?? [];
  const allGarageOptions = allGarageOpts ?? [];

  // Customer's preferred garage (carried in symptoms; survives ops reassignment).
  const preferredRaw = (booking.symptoms as { preferredGarage?: unknown } | null)
    ?.preferredGarage;
  const preferredGarageLabel =
    typeof preferredRaw === "string" ? preferredRaw : null;
  const preferredIdRaw = (booking.symptoms as { preferredGarageId?: unknown } | null)
    ?.preferredGarageId;
  const preferredGarageId =
    typeof preferredIdRaw === "string" ? preferredIdRaw : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <Link href="/ops/bookings" className="text-sm text-muted-foreground hover:underline">
              ← All bookings
            </Link>
            <h1 className="text-lg font-semibold text-foreground mt-1">
              {booking.shortId} · {booking.bucket}
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">Signed in as {session.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-6">
          <div className="rounded-md border border-border-subtle bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground">{booking.status.replace(/_/g, " ")}</dd>
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="text-foreground">
                {profile?.first_name ?? "Unknown"}
                {profile?.phone ? (
                  <a
                    href={`tel:${profile.phone}`}
                    className="ms-2 tabular text-pulse-600 hover:underline"
                    title="Call customer"
                  >
                    {profile.phone}
                  </a>
                ) : null}
              </dd>
              <dt className="text-muted-foreground">Slot</dt>
              <dd className="text-foreground">{booking.slotLabel}</dd>
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="capitalize text-foreground">{booking.paymentMode}</dd>
              <dt className="text-muted-foreground">Base total</dt>
              <dd className="tabular text-foreground">
                {booking.baseTotal != null ? rupees(booking.baseTotal) : "—"}
              </dd>
              <dt className="text-muted-foreground">Current quote</dt>
              <dd className="tabular text-foreground">
                {booking.total != null ? rupees(booking.total) : "—"}
              </dd>
              <dt className="text-muted-foreground">Garage</dt>
              <dd className="text-foreground">
                {booking.garage
                  ? `${booking.garage.shopName} — ${booking.garage.area}`
                  : "Unassigned"}
              </dd>
              {preferredGarageLabel ? (
                <>
                  <dt className="text-muted-foreground">Customer preferred</dt>
                  <dd className="text-foreground">{preferredGarageLabel}</dd>
                </>
              ) : null}
            </dl>
          </div>

          {booking.services && booking.services.length > 0 && (
            <div className="rounded-md border border-border-subtle bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Services
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {booking.services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span className="text-foreground">{s.name}</span>
                    <span className="tabular text-muted-foreground">
                      {s.isQuoted ? "Quoted" : rupees(s.basePrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(() => {
            const raw = (booking.symptoms as { services?: unknown } | null)
              ?.services;
            const names = Array.isArray(raw)
              ? raw.filter((x): x is string => typeof x === "string")
              : [];
            if (names.length === 0) return null;
            return (
              <div className="rounded-md border border-border-subtle bg-card p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Requested services
                </h2>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                  {names.map((n) => (
                    <li key={n}>• {n}</li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {signedPhotos.length > 0 && (
            <div className="rounded-md border border-border-subtle bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Photos ({signedPhotos.length})
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {signedPhotos.map((p) =>
                  p.signedUrl ? (
                    <a
                      key={p.id}
                      href={p.signedUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block aspect-square overflow-hidden rounded-md border border-border-subtle"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.signedUrl}
                        alt="booking attachment"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <div
                      key={p.id}
                      className="aspect-square rounded-md border border-dashed border-border bg-muted"
                    />
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <OpsBookingActions
            bookingId={booking.id}
            shortId={booking.shortId}
            currentStatus={booking.status}
            currentTotal={booking.total}
            currentGarageId={booking.garageId ?? preferredGarageId}
            garageOptions={garageOptions.map((g) => ({
              id: g.id,
              label: `${g.shop_name} — ${g.area}`,
            }))}
            allGarageOptions={allGarageOptions.map((g) => ({
              id: g.id,
              label: `${g.shop_name} — ${g.area}`,
            }))}
            initialNotes={notes}
          />
        </aside>
      </main>
    </div>
  );
}
