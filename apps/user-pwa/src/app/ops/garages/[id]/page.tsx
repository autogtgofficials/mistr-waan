import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getOpsSession } from "@/lib/auth/session";
import { getGarageById } from "@/lib/garage/data";
import { OpsGarageActions } from "./OpsGarageActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpsGarageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/garages");
  const { id } = await params;
  const garage = await getGarageById(id);
  if (!garage) notFound();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <Link
              href={`/ops/garages?status=${garage.onboardingStatus ?? "active"}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              ← All garages
            </Link>
            <h1 className="text-lg font-semibold text-foreground mt-1">
              {garage.shopName}
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">
            Signed in as {session.email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-6">
          <div className="rounded-md border border-border-subtle bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Workshop
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Shop name</dt>
              <dd className="font-medium text-foreground">{garage.shopName}</dd>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="text-foreground">
                {garage.ownerFirstName} {garage.ownerLastName}
              </dd>
              <dt className="text-muted-foreground">Area</dt>
              <dd className="text-foreground">{garage.area}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="tabular text-foreground">{garage.phone}</dd>
              <dt className="text-muted-foreground">WhatsApp</dt>
              <dd className="tabular text-foreground">
                {garage.whatsappPhone ?? garage.phone}
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground">
                {garage.onboardingStatus ?? "active"}{" "}
                {garage.active ? "(accepting jobs)" : "(paused)"}
              </dd>
            </dl>
          </div>

          <div className="rounded-md border border-border-subtle bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Capabilities
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Services</dt>
              <dd className="text-foreground capitalize">
                {garage.serviceBuckets.join(", ").replace(/_/g, " ")}
              </dd>
              <dt className="text-muted-foreground">Working hours</dt>
              <dd className="text-foreground">{garage.workingHours ?? "—"}</dd>
              <dt className="text-muted-foreground">Weekly off</dt>
              <dd className="text-foreground">{garage.weeklyOff ?? "—"}</dd>
              <dt className="text-muted-foreground">RSA</dt>
              <dd className="text-foreground">
                {garage.rsaAvailable
                  ? `Yes (${garage.rsaRadiusKm ?? "—"} km)`
                  : "No"}
              </dd>
              <dt className="text-muted-foreground">Pickup</dt>
              <dd className="text-foreground">
                {garage.pickupAvailable ? "Yes" : "No"}
              </dd>
              <dt className="text-muted-foreground">Commission</dt>
              <dd className="text-foreground">{garage.commissionPct}%</dd>
            </dl>
          </div>

          <VerificationDocPreview garageId={garage.id} hasDoc={!!garage.verificationDocPath} />
        </section>

        <aside>
          <OpsGarageActions
            garageId={garage.id}
            shopName={garage.shopName}
            currentStatus={garage.onboardingStatus ?? "active"}
            currentActive={garage.active}
          />
        </aside>
      </main>
    </div>
  );
}

function VerificationDocPreview({
  garageId,
  hasDoc,
}: {
  garageId: string;
  hasDoc: boolean;
}) {
  if (!hasDoc) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        No verification document uploaded.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border-subtle bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Verification document
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Aadhaar / DL / Shop Registration / GST submitted at signup. URL is
        signed and short-lived.
      </p>
      <a
        href={`/api/ops/garages/${garageId}/verification-doc`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex h-9 items-center rounded-md border border-border-subtle px-3 text-sm font-medium hover:bg-muted"
      >
        Open document →
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        Opens a fresh signed URL; refresh this page if the link expires.
      </p>
    </div>
  );
}
