"use client";

import { useMemo, useState } from "react";
import { CallToConfirm } from "@/components/booking/CallToConfirm";
import { rupees, cn } from "@/lib/utils";
import type { CatalogService } from "@/lib/services/catalog";

type VehicleType = "car" | "bike";

/**
 * Scheduled Maintenance browse + call-first booking.
 *
 * No login, no payment, no booking POST. The customer browses prices, picks
 * their vehicle + service for context, then taps "Call to confirm" — ops
 * takes it from there on the phone (confirms the mechanic, creates the
 * booking, customer pays after logging in to track it).
 */
export function MaintenanceForm({
  carServices,
  bikeServices,
}: {
  carServices: CatalogService[];
  bikeServices: CatalogService[];
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [serviceId, setServiceId] = useState<string | null>(null);

  const services = vehicleType === "car" ? carServices : bikeServices;
  const picked = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Vehicle type */}
      <section>
        <h2 className="text-sm font-semibold text-foreground">Vehicle</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["car", "bike"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVehicleType(v);
                setServiceId(null);
              }}
              className={cn(
                "h-11 rounded-md border text-sm font-medium",
                vehicleType === v
                  ? "border-pulse-500 bg-pulse-50 text-pulse-700"
                  : "border-border bg-card text-foreground",
              )}
            >
              {v === "bike" ? "Bike / 2-wheeler" : "Car"}
            </button>
          ))}
        </div>
      </section>

      {/* Service (browse / pick for context) */}
      <section>
        <h2 className="text-sm font-semibold text-foreground">Service</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setServiceId(s.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border p-3 text-left",
                  serviceId === s.id
                    ? "border-pulse-500 bg-pulse-50"
                    : "border-border bg-card",
                )}
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  {s.blurb ? (
                    <span className="text-xs text-muted-foreground">{s.blurb}</span>
                  ) : null}
                </span>
                <span className="tabular text-sm font-medium text-foreground">
                  {s.isQuoted ? "On quote" : rupees(s.basePrice)}
                </span>
              </button>
            </li>
          ))}
          {services.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No {vehicleType} services configured yet.
            </li>
          )}
        </ul>
      </section>

      {/* Call-first CTA */}
      <CallToConfirm
        serviceLabel={
          picked
            ? `${vehicleType === "bike" ? "Bike" : "Car"} ${picked.name.toLowerCase()}`
            : undefined
        }
      />
    </div>
  );
}
