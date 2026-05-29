"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { CatalogService } from "@/lib/services/catalog";

type VehicleType = "car" | "bike";

/**
 * Emergency RSA request form. Self-contained: posts to /api/bookings with
 * bucket=rsa and slotLabel "ASAP (RSA)". Garage left null → ops dispatches.
 */
export function RsaForm({ services }: { services: CatalogService[] }) {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [serviceId, setServiceId] = useState<string | null>(
    services[0]?.id ?? null,
  );
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          bucket: "rsa",
          serviceIds: [serviceId],
          slotLabel: "ASAP (RSA)",
          paymentMode: "cash",
          vehicleType,
          vehicleBrand: brand.trim(),
          vehicleModel: model.trim(),
          symptoms: description.trim()
            ? { description: description.trim(), source: "web_rsa" }
            : null,
        }),
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/rsa")}`);
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
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
    } finally {
      setBusy(false);
    }
  }

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

      <section>
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <div className="mt-2 flex flex-col gap-2">
          <input
            placeholder="Vehicle brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
          <input
            placeholder="Vehicle model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
          <textarea
            rows={2}
            maxLength={500}
            placeholder="Anything else we should know? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-card p-3 text-sm"
          />
        </div>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button onClick={() => void submit()} loading={busy} disabled={!canSubmit} className="w-full">
        Request assistance
      </Button>
      <p className="-mt-3 text-center text-xs text-muted-foreground">
        Payment settled on-site after the job. We&apos;ll call you immediately.
      </p>
    </div>
  );
}
