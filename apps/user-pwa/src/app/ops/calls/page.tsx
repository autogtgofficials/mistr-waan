import { redirect } from "next/navigation";
import Link from "next/link";
import { Phone } from "lucide-react";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsBookings } from "@/lib/bookings/ops-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /ops/calls — the "calls to make" queue.
 *
 * Every booking sitting in `queued_for_call`, oldest-waiting first, with the
 * customer's number one tap away and what they asked for, so ops can work the
 * list top-to-bottom.
 */
export default async function OpsCallsPage() {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login?next=/ops/calls");

  const calls = await listOpsBookings({
    status: "queued_for_call",
    order: "asc",
    limit: 200,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <Link href="/ops" className="text-sm text-muted-foreground hover:underline">
              ← Ops home
            </Link>
            <h1 className="text-lg font-semibold text-foreground mt-1">
              Calls to make
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">
            {calls.length} waiting · {session.email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {calls.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-12 text-center text-muted-foreground">
            No one waiting for a call. 🎉
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {calls.map((b) => {
              const services = pickServices(b.symptoms);
              const preferred = pickPreferred(b.symptoms);
              return (
                <li
                  key={b.id}
                  className="rounded-md border border-border-subtle bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {b.customerFirstName ?? "Customer"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular">
                          {b.shortId} · {b.bucket}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Waiting {waitedFor(b.createdAt)}
                        {services.length > 0 ? ` · ${services.join(", ")}` : ""}
                      </p>
                      {preferred ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Prefers: {preferred}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {b.customerPhone ? (
                        <a
                          href={`tel:${b.customerPhone}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-pulse-600 px-3 text-sm font-medium text-white"
                        >
                          <Phone className="size-4" strokeWidth={2} />
                          {b.customerPhone}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No phone</span>
                      )}
                      <Link
                        href={`/ops/bookings/${b.shortId}`}
                        className="text-sm font-medium text-pulse-700 hover:underline"
                      >
                        Open booking →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function pickServices(symptoms: Record<string, unknown> | null): string[] {
  const s = symptoms?.services;
  return Array.isArray(s) ? s.filter((x): x is string => typeof x === "string") : [];
}

function pickPreferred(symptoms: Record<string, unknown> | null): string | null {
  const p = symptoms?.preferredGarage;
  return typeof p === "string" ? p : null;
}

function waitedFor(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
