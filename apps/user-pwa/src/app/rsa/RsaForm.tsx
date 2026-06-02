"use client";

import { useState } from "react";
import { CallToConfirm } from "@/components/booking/CallToConfirm";
import { cn } from "@/lib/utils";
import type { CatalogService } from "@/lib/services/catalog";

type VehicleType = "car" | "bike";

/**
 * Emergency RSA — browse the issue list, then call us. No login, no payment,
 * no booking POST: for a roadside emergency the fastest path is a phone call,
 * and ops dispatches the nearest mechanic immediately. Payment settles on-site.
 */
export function RsaForm({ services }: { services: CatalogService[] }) {
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [serviceId, setServiceId] = useState<string | null>(
    services[0]?.id ?? null,
  );
  const picked = services.find((s) => s.id === serviceId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold text-foreground">Vehicle</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["car", "bike"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVehicleType(v)}
              className={cn(
                "h-11 rounded-md border text-sm font-medium",
                vehicleType === v
                  ? "border-ignite-500 bg-orange-50 text-ignite-700"
                  : "border-border bg-card text-foreground",
              )}
            >
              {v === "bike" ? "Bike / 2-wheeler" : "Car"}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">What&apos;s wrong?</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setServiceId(s.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border p-3 text-left",
                  serviceId === s.id
                    ? "border-ignite-500 bg-orange-50"
                    : "border-border bg-card",
                )}
              >
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <span className="tabular text-xs text-muted-foreground">
                  {s.isQuoted ? "On quote" : `₹${s.basePrice}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <CallToConfirm serviceLabel={picked ? picked.name.toLowerCase() : undefined} />
    </div>
  );
}
