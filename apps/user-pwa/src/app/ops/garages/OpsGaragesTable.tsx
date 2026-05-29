"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Garage, GarageOnboardingStatus } from "@/lib/garage/data";

const STATUS_FILTERS: { value: GarageOnboardingStatus; label: string }[] = [
  { value: "pending_verification", label: "Pending verification" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

const STATUS_STYLE: Record<GarageOnboardingStatus, string> = {
  pending_verification: "bg-pulse-50 text-pulse-700 border-pulse-100",
  active: "bg-aqua-50 text-aqua-700 border-aqua-100",
  rejected: "bg-orange-50 text-ignite-700 border-orange-100",
  suspended: "bg-muted text-muted-foreground border-border",
};

export function OpsGaragesTable({
  garages,
  currentStatus,
}: {
  garages: Garage[];
  currentStatus: GarageOnboardingStatus;
}) {
  const router = useRouter();
  const search = useSearchParams();

  function setStatus(value: GarageOnboardingStatus) {
    const next = new URLSearchParams(search.toString());
    next.set("status", value);
    router.push(`/ops/garages?${next.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border-subtle">
        <select
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
          value={currentStatus}
          onChange={(e) => setStatus(e.target.value as GarageOnboardingStatus)}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="ms-auto text-sm text-muted-foreground tabular">
          {garages.length} garage{garages.length === 1 ? "" : "s"}
        </span>
      </div>

      {garages.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border p-12 text-center text-muted-foreground">
          No garages match this filter.
        </div>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pe-3">Shop</th>
              <th className="py-2 pe-3">Owner</th>
              <th className="py-2 pe-3">Area</th>
              <th className="py-2 pe-3">Phone</th>
              <th className="py-2 pe-3">Services</th>
              <th className="py-2 pe-3">Status</th>
              <th className="py-2 pe-3" />
            </tr>
          </thead>
          <tbody>
            {garages.map((g) => (
              <tr
                key={g.id}
                className="border-b border-border-subtle align-top hover:bg-muted/40"
              >
                <td className="py-3 pe-3">
                  <Link
                    href={`/ops/garages/${g.id}`}
                    className="font-medium text-pulse-700 hover:underline"
                  >
                    {g.shopName}
                  </Link>
                </td>
                <td className="py-3 pe-3 text-foreground">
                  {g.ownerFirstName} {g.ownerLastName}
                </td>
                <td className="py-3 pe-3 text-foreground">{g.area}</td>
                <td className="py-3 pe-3 tabular text-foreground">{g.phone}</td>
                <td className="py-3 pe-3 capitalize text-foreground">
                  {g.serviceBuckets.join(", ").replace(/_/g, " ")}
                </td>
                <td className="py-3 pe-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[g.onboardingStatus ?? "active"]
                    }`}
                  >
                    {(g.onboardingStatus ?? "active").replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3 pe-3">
                  <Link
                    href={`/ops/garages/${g.id}`}
                    className="text-xs text-pulse-700 hover:underline"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
