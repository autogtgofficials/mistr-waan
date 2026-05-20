"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Wallet,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/jobs/StatusPill";
import { useGarageJobs } from "@/lib/store/jobs";
import { rupees } from "@/lib/utils";

/**
 * Garage job detail. Actions depend on status:
 *   pending          → Accept | Reject
 *   quote_requested  → Submit quote (mock)
 *   assigned         → Mark in progress
 *   in_progress      → Mark complete
 *   completed        → (read-only) earnings line, payout note
 *   cancelled        → (read-only)
 */
export default function GarageJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { jobs, hydrated, updateStatus } = useGarageJobs();
  const job = jobs.find((j) => j.id === id);
  const [quoteAmount, setQuoteAmount] = useState("");

  useEffect(() => {
    if (hydrated && !job) router.replace("/");
  }, [hydrated, job, router]);

  if (!hydrated) return <div className="flex min-h-full" />;
  if (!job) return null;

  const customerCallHref = `tel:+91XXXXXXXXXX`; // masked DID — Exotel later

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
        title={<span className="truncate">{job.summary}</span>}
      />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {/* Status hero */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-foreground">{job.summary}</h1>
              <p className="mt-1 text-sm text-muted-foreground capitalize">
                {job.bucket} · ID {job.id}
              </p>
            </div>
            <StatusPill status={job.status} />
          </div>

          <Divider />

          {/* Customer info — anonymised pre-acceptance */}
          <Section title="Customer">
            <p className="text-base font-semibold text-foreground">{job.customerLabel}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {job.customerArea}
              {job.status === "pending" || job.status === "quote_requested" ? (
                <span className="ms-2 text-xs text-muted-foreground">
                  (full address shown after you accept)
                </span>
              ) : null}
            </p>
            {job.status !== "pending" && job.status !== "quote_requested" ? (
              <a
                href={customerCallHref}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Phone className="size-4" strokeWidth={2} />
                Call customer (masked)
              </a>
            ) : null}
          </Section>

          <Divider />

          {/* Slot + payment */}
          <Section title="Slot">
            <p className="text-base text-foreground">{job.slotLabel || "—"}</p>
          </Section>

          <Divider />

          <Section title="Payment">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Wallet className="size-4" strokeWidth={2} />
              {job.total > 0 ? (
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
            {job.commissionCut > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Mister Waan fee: {rupees(job.commissionCut)} (12%)
              </p>
            ) : null}

            {job.status === "completed" && job.paymentMode === "cash" ? (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-orange-50 border border-orange-100 p-3">
                <AlertCircle className="size-4 shrink-0 text-ignite-700" strokeWidth={2} />
                <p className="text-xs text-ignite-900">
                  Settle commission of {rupees(job.commissionCut)} via UPI by Sunday.
                </p>
              </div>
            ) : null}
          </Section>

          {/* Demo quote-submit field */}
          {job.status === "quote_requested" ? (
            <>
              <Divider />
              <Section title="Submit quote">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 18500"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value.replace(/\D/g, ""))}
                  className="tabular w-full rounded-md border border-input bg-card p-3 text-base text-foreground outline-none placeholder:text-steel-300 focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Customer sees this alongside up to 2 other quotes.
                </p>
              </Section>
            </>
          ) : null}
        </div>
      </main>

      {/* Sticky bottom action(s) by status */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-md">
          {job.status === "pending" ? (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => updateStatus(job.id, "cancelled")}
                inline
                className="flex-1 text-danger hover:bg-danger-soft"
              >
                <XCircle className="size-4" strokeWidth={2} /> Reject
              </Button>
              <Button
                onClick={() => updateStatus(job.id, "assigned")}
                inline
                className="flex-1"
              >
                <CheckCircle2 className="size-4" strokeWidth={2} /> Accept
              </Button>
            </div>
          ) : job.status === "quote_requested" ? (
            <Button
              onClick={() => updateStatus(job.id, "assigned")}
              disabled={!quoteAmount}
              className="w-full"
            >
              Send quote
            </Button>
          ) : job.status === "assigned" ? (
            <Button
              onClick={() => updateStatus(job.id, "in_progress")}
              className="w-full"
            >
              Mark in progress
            </Button>
          ) : job.status === "in_progress" ? (
            <Button
              onClick={() => updateStatus(job.id, "completed")}
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
