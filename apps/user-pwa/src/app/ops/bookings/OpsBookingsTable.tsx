"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { OpsBookingRow } from "@/lib/bookings/ops-data";
import { rupees, timeAgo } from "@/lib/utils";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued_for_call", label: "Awaiting call" },
  { value: "quoted", label: "Quote ready" },
  { value: "awaiting_garage", label: "Finding garage" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined_by_garage", label: "Declined" },
];

const BUCKET_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All buckets" },
  { value: "detailing", label: "Detailing" },
  { value: "repairs", label: "Repairs" },
  { value: "denting", label: "Denting" },
];

const STATUS_STYLE: Record<string, string> = {
  queued_for_call: "bg-pulse-50 text-pulse-700 border-pulse-100",
  quoted: "bg-pulse-50 text-pulse-700 border-pulse-100",
  awaiting_garage: "bg-pulse-50 text-pulse-700 border-pulse-100",
  assigned: "bg-aqua-50 text-aqua-700 border-aqua-100",
  in_progress: "bg-orange-50 text-ignite-700 border-orange-100",
  completed: "bg-aqua-50 text-aqua-700 border-aqua-100",
  cancelled: "bg-muted text-muted-foreground border-border",
  declined_by_garage: "bg-orange-50 text-ignite-700 border-orange-100",
};

export function OpsBookingsTable({
  bookings,
  currentStatus,
  currentBucket,
}: {
  bookings: OpsBookingRow[];
  currentStatus: string;
  currentBucket: string;
}) {
  const router = useRouter();
  const search = useSearchParams();

  function setFilter(key: "status" | "bucket", value: string) {
    const next = new URLSearchParams(search.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/ops/bookings${next.toString() ? `?${next.toString()}` : ""}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border-subtle">
        <select
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
          value={currentStatus}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
          value={currentBucket}
          onChange={(e) => setFilter("bucket", e.target.value)}
        >
          {BUCKET_FILTERS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <span className="ms-auto text-sm text-muted-foreground tabular">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border p-12 text-center text-muted-foreground">
          No bookings match these filters.
        </div>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pe-3">ID</th>
              <th className="py-2 pe-3">Customer</th>
              <th className="py-2 pe-3">Bucket</th>
              <th className="py-2 pe-3">Garage</th>
              <th className="py-2 pe-3">Slot</th>
              <th className="py-2 pe-3">Total</th>
              <th className="py-2 pe-3">Status</th>
              <th className="py-2 pe-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const days = Math.max(
                0,
                Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 86400000),
              );
              const amount = b.total ?? b.baseTotal ?? 0;
              return (
                <tr key={b.id} className="border-b border-border-subtle align-top">
                  <td className="py-3 pe-3 tabular font-mono text-xs">{b.shortId}</td>
                  <td className="py-3 pe-3">
                    <div className="font-medium text-foreground">
                      {b.customerFirstName ?? "User"}
                    </div>
                    <div className="text-xs text-muted-foreground tabular">{b.customerPhone}</div>
                  </td>
                  <td className="py-3 pe-3 capitalize">{b.bucket}</td>
                  <td className="py-3 pe-3">
                    {b.garage ? (
                      <>
                        <div className="font-medium text-foreground">
                          {b.garage.ownerFirstName} {b.garage.ownerLastName.charAt(0)}.
                        </div>
                        <div className="text-xs text-muted-foreground">{b.garage.area}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 pe-3">{b.slotLabel}</td>
                  <td className="py-3 pe-3 tabular">
                    {amount > 0 ? rupees(amount) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 pe-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[b.status] ?? "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {b.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 pe-3 text-muted-foreground text-xs">{timeAgo(days)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
