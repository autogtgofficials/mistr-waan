"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { rupees, cn } from "@/lib/utils";
import type { CatalogService } from "@/lib/services/catalog";

type VehicleType = "car" | "bike";

const SLOTS = [
  "Today afternoon (3 PM)",
  "Tomorrow morning (10 AM)",
  "Tomorrow afternoon (3 PM)",
  "This weekend (Sat 11 AM)",
];

/**
 * Self-contained Scheduled Maintenance booking form. Posts straight to the
 * real /api/bookings (garage left null → ops assigns), then redirects to the
 * confirmation page. Keeps the legacy multi-step draft flow untouched.
 */
export function MaintenanceForm({
  carServices,
  bikeServices,
}: {
  carServices: CatalogService[];
  bikeServices: CatalogService[];
}) {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>(SLOTS[1]!);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [reg, setReg] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const services = vehicleType === "car" ? carServices : bikeServices;
  const picked = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  const upiEnabled = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";
  const canSubmit = !!serviceId && brand.trim() && model.trim() && !busy;

  async function submit() {
    if (!serviceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bucket: "scheduled_maintenance",
          serviceIds: [serviceId],
          slotLabel: slot,
          paymentMode,
          vehicleType,
          vehicleBrand: brand.trim(),
          vehicleModel: model.trim(),
          vehicleRegistration: reg.trim() || null,
        }),
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/maintenance")}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        booking?: { shortId: string };
        error?: string;
      };
      if (!res.ok || !data.booking) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.replace(`/booking/confirmation/${data.booking.shortId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book. Try again.");
    } finally {
      setBusy(false);
    }
  }

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
                "h-11 rounded-md border text-sm font-medium capitalize",
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

      {/* Service */}
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

      {/* Slot */}
      <section>
        <h2 className="text-sm font-semibold text-foreground">Preferred slot</h2>
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Our team confirms the exact time when they call.
        </p>
      </section>

      {/* Vehicle details */}
      <section>
        <h2 className="text-sm font-semibold text-foreground">Vehicle details</h2>
        <div className="mt-2 flex flex-col gap-2">
          <input
            placeholder={vehicleType === "bike" ? "Brand (e.g. Hero)" : "Brand (e.g. Maruti)"}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
          <input
            placeholder={vehicleType === "bike" ? "Model (e.g. Splendor)" : "Model (e.g. Swift)"}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
          <input
            placeholder="Registration (optional)"
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm tabular"
          />
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="text-sm font-semibold text-foreground">Payment</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMode("cash")}
            className={cn(
              "h-11 rounded-md border text-sm font-medium",
              paymentMode === "cash"
                ? "border-pulse-500 bg-pulse-50 text-pulse-700"
                : "border-border bg-card text-foreground",
            )}
          >
            Cash on visit
          </button>
          <button
            type="button"
            disabled={!upiEnabled}
            onClick={() => setPaymentMode("upi")}
            className={cn(
              "h-11 rounded-md border text-sm font-medium disabled:opacity-40",
              paymentMode === "upi"
                ? "border-pulse-500 bg-pulse-50 text-pulse-700"
                : "border-border bg-card text-foreground",
            )}
          >
            UPI {upiEnabled ? "online" : "(soon)"}
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button onClick={() => void submit()} loading={busy} disabled={!canSubmit} className="w-full">
        {picked
          ? `Book ${picked.name}${picked.isQuoted ? "" : ` · ${rupees(picked.basePrice)}`}`
          : "Select a service"}
      </Button>
      <p className="-mt-3 text-center text-xs text-muted-foreground">
        We&apos;ll call you in a few minutes to confirm and assign a garage.
      </p>
    </div>
  );
}
