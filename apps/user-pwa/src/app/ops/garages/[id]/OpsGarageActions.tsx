"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GarageOnboardingStatus } from "@/lib/garage/data";

export function OpsGarageActions(props: {
  garageId: string;
  shopName: string;
  currentStatus: GarageOnboardingStatus;
  currentActive: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "activate" | "reject" | "suspend">(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function patch(args: {
    onboarding_status: GarageOnboardingStatus;
    active?: boolean;
    rejected_reason?: string;
  }, kind: "activate" | "reject" | "suspend") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/ops/garages/${props.garageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Actions</h3>

      {props.currentStatus !== "active" && (
        <button
          type="button"
          onClick={() =>
            patch(
              { onboarding_status: "active", active: true },
              "activate",
            )
          }
          disabled={busy !== null}
          className="h-10 w-full rounded-md bg-pulse-600 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === "activate" ? "Activating…" : "✓ Activate (live)"}
        </button>
      )}

      {!showReject ? (
        <button
          type="button"
          onClick={() => setShowReject(true)}
          disabled={busy !== null}
          className="h-10 w-full rounded-md border border-ignite-200 bg-ignite-50 text-sm font-medium text-ignite-700 disabled:opacity-50"
        >
          ✗ Reject
        </button>
      ) : (
        <div className="rounded-md border border-ignite-200 bg-ignite-50 p-3">
          <label className="text-xs text-ignite-900">
            Reject reason (sent to mechanic via WhatsApp)
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Verification document was unclear"
            className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowReject(false);
                setRejectReason("");
              }}
              disabled={busy !== null}
              className="h-8 px-3 rounded-md border border-border-subtle text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                patch(
                  {
                    onboarding_status: "rejected",
                    active: false,
                    rejected_reason: rejectReason || undefined,
                  },
                  "reject",
                )
              }
              disabled={busy !== null || rejectReason.trim().length === 0}
              className="h-8 flex-1 rounded-md bg-ignite-700 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy === "reject" ? "Rejecting…" : "Confirm reject"}
            </button>
          </div>
        </div>
      )}

      {props.currentStatus === "active" && (
        <button
          type="button"
          onClick={() =>
            patch(
              { onboarding_status: "suspended", active: false },
              "suspend",
            )
          }
          disabled={busy !== null}
          className="h-10 w-full rounded-md border border-border-subtle text-sm font-medium disabled:opacity-50"
        >
          {busy === "suspend" ? "Suspending…" : "Suspend"}
        </button>
      )}

      {error && (
        <p className="rounded-md border border-ignite-100 bg-ignite-50 p-2 text-xs text-ignite-900">
          {error}
        </p>
      )}
    </div>
  );
}
