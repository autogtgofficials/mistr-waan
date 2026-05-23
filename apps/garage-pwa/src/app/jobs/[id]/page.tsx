"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Wallet,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/jobs/StatusPill";
import { api } from "@/lib/api/client";
import { useGarageAuth } from "@/lib/store/auth";
import { garageActions } from "@/lib/store/jobs";
import type { GarageJob } from "@/lib/api/types";
import { rupees } from "@/lib/utils";

/**
 * Real-backend garage job detail. Action set is determined by status:
 *   awaiting_garage  → Accept | Decline
 *   assigned         → Mark in progress
 *   in_progress      → Mark complete
 *   completed        → read-only summary
 *   cancelled / declined_by_garage → read-only
 */
export default function GarageJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthed, hydrated: authHydrated } = useGarageAuth();
  const [job, setJob] = useState<GarageJob | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "not_found" | "error">(
    "loading",
  );
  const [busy, setBusy] = useState<null | "respond" | "start" | "complete">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (authHydrated && !isAuthed) router.replace("/login");
  }, [authHydrated, isAuthed, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<{ job: GarageJob }>(`/api/garage/jobs/${id}`);
        if (!cancelled) {
          setJob(data.job);
          setLoadState("loaded");
        }
      } catch (err) {
        if (cancelled) return;
        // ApiError shape: status + code
        const e = err as { status?: number };
        setLoadState(e.status === 404 ? "not_found" : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function doRespond(outcome: "accept" | "decline") {
    if (!job) return;
    setBusy("respond");
    setActionError(null);
    try {
      const { booking } = await garageActions.respond({ bookingId: job.id, outcome });
      setJob(booking);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(null);
    }
  }
  async function doStart() {
    if (!job) return;
    setBusy("start");
    setActionError(null);
    try {
      const { booking } = await garageActions.start(job.id);
      setJob(booking);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(null);
    }
  }
  async function doComplete() {
    if (!job) return;
    setBusy("complete");
    setActionError(null);
    try {
      const { booking } = await garageActions.complete(job.id);
      setJob(booking);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(null);
    }
  }

  if (!authHydrated || loadState === "loading")
    return <div className="flex min-h-full" />;
  if (loadState === "not_found") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Job not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This job isn&apos;t assigned to your garage.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-primary underline"
        >
          Back to inbox
        </button>
      </div>
    );
  }
  if (loadState === "error" || !job) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Couldn&apos;t load job</h1>
        <p className="mt-1 text-sm text-muted-foreground">Try refreshing.</p>
      </div>
    );
  }

  const summary =
    job.services && job.services.length > 0
      ? job.services.map((s) => s.name).join(", ")
      : job.bucket;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <button
            onClick={() => router.push("/")}
            aria-label="Back"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </button>
        }
        title={<span className="truncate">{summary}</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-foreground">{summary}</h1>
              <p className="mt-1 text-sm text-muted-foreground capitalize">
                {job.bucket} · {job.shortId}
              </p>
            </div>
            <StatusPill status={job.status} />
          </div>

          <Divider />

          <Section title="Customer">
            <p className="text-base font-semibold text-foreground">{job.customerLabel}</p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular">
              {job.customerPhoneMasked}
              {job.status === "awaiting_garage" ? (
                <span className="ms-2 text-xs">(unmasked after you accept)</span>
              ) : null}
            </p>
            {job.status !== "awaiting_garage" ? (
              <a
                href={`tel:${job.customerPhoneMasked.replace(/\D+/g, "")}`}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Phone className="size-4" strokeWidth={2} />
                Call customer (masked)
              </a>
            ) : null}
          </Section>

          <Divider />

          <Section title="Slot">
            <p className="text-base text-foreground">{job.slotLabel || "—"}</p>
          </Section>

          <Divider />

          <Section title="Payment">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Wallet className="size-4" strokeWidth={2} />
              {job.total != null && job.total > 0 ? (
                <>
                  <span className="tabular font-semibold">{rupees(job.total)}</span>
                  <span className="text-muted-foreground">
                    {job.paymentMode === "upi"
                      ? "Prepaid via UPI — payout T+2"
                      : "Cash on completion"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Quote pending</span>
              )}
            </div>
            {job.commissionCut != null && job.commissionCut > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Mister Waan fee: {rupees(job.commissionCut)}
              </p>
            ) : null}

            {job.status === "completed" && job.paymentMode === "cash" && job.commissionCut ? (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-orange-50 border border-orange-100 p-3">
                <AlertCircle className="size-4 shrink-0 text-ignite-700" strokeWidth={2} />
                <p className="text-xs text-ignite-900">
                  Settle commission of {rupees(job.commissionCut)} via UPI by Sunday.
                </p>
              </div>
            ) : null}
          </Section>

          {actionError ? (
            <p className="mt-4 rounded-md border border-ignite-100 bg-ignite-50 p-3 text-sm text-ignite-900">
              {actionError}
            </p>
          ) : null}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-md">
          {job.status === "awaiting_garage" ? (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => void doRespond("decline")}
                loading={busy === "respond"}
                inline
                className="flex-1 text-danger hover:bg-danger-soft"
              >
                <XCircle className="size-4" strokeWidth={2} /> Decline
              </Button>
              <Button
                onClick={() => void doRespond("accept")}
                loading={busy === "respond"}
                inline
                className="flex-1"
              >
                <CheckCircle2 className="size-4" strokeWidth={2} /> Accept
              </Button>
            </div>
          ) : job.status === "assigned" ? (
            <Button onClick={() => void doStart()} loading={busy === "start"} className="w-full">
              Mark in progress
            </Button>
          ) : job.status === "in_progress" ? (
            <Button
              onClick={() => void doComplete()}
              loading={busy === "complete"}
              className="w-full"
            >
              Mark complete
            </Button>
          ) : (
            <Button onClick={() => router.push("/")} variant="secondary" className="w-full">
              Back to inbox
            </Button>
          )}
        </div>
      </div>

      <TabBar />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Divider() {
  return <hr className="my-6 border-t border-border-subtle" />;
}
