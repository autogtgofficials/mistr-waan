"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Bucket =
  | "detailing"
  | "repairs"
  | "denting"
  | "scheduled_maintenance"
  | "rsa";

interface ServiceOption {
  id: string;
  name: string;
  bucket: Bucket;
  isQuoted: boolean;
  basePrice: number;
}
interface GarageOption {
  id: string;
  label: string;
  serviceBuckets: string[];
}

const BUCKETS: { value: Bucket; label: string }[] = [
  { value: "scheduled_maintenance", label: "Scheduled Maintenance" },
  { value: "rsa", label: "Roadside Assistance" },
  { value: "detailing", label: "Detailing" },
  { value: "repairs", label: "Repairs" },
  { value: "denting", label: "Denting & Painting" },
];

/**
 * Ops "create booking from a call" form. Posts to POST /api/ops/bookings,
 * which upserts the customer by phone + creates the booking. On success,
 * jumps to the new booking's detail page so ops can quote/assign right away.
 */
export function OpsNewBookingForm({
  services,
  garages,
}: {
  services: ServiceOption[];
  garages: GarageOption[];
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [bucket, setBucket] = useState<Bucket>("scheduled_maintenance");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [garageId, setGarageId] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
  const [vehicleType, setVehicleType] = useState<"" | "car" | "bike">("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bucketServices = useMemo(
    () => services.filter((s) => s.bucket === bucket),
    [services, bucket],
  );
  const bucketGarages = useMemo(
    () => garages.filter((g) => g.serviceBuckets.includes(bucket)),
    [garages, bucket],
  );

  const phoneOk = /^(\+?91)?[6-9]\d{9}$/.test(phone.replace(/\s+/g, ""));
  const canSubmit = phoneOk && !busy;

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          firstName: firstName || undefined,
          bucket,
          serviceIds,
          garageId: garageId || undefined,
          slotLabel: slotLabel || undefined,
          paymentMode,
          vehicleType: vehicleType || undefined,
          vehicleBrand: vehicleBrand || undefined,
          vehicleModel: vehicleModel || undefined,
          vehicleRegistration: vehicleReg || undefined,
        }),
      });
      const data = (await res.json()) as {
        booking?: { id: string; shortId: string };
        error?: string;
      };
      if (!res.ok || !data.booking) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/ops/bookings/${data.booking.shortId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const labelCls = "text-xs text-muted-foreground";
  const inputCls =
    "mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Customer
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Phone *</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 6006617842"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>First name (optional)</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        {!phoneOk && phone.length > 0 ? (
          <p className="mt-1 text-xs text-ignite-700">Enter a valid Indian mobile.</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          We&apos;ll create a profile for this number so the customer can log in
          to track + pay.
        </p>
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Service
        </h2>
        <label className="mt-3 block">
          <span className={labelCls}>Category</span>
          <select
            value={bucket}
            onChange={(e) => {
              setBucket(e.target.value as Bucket);
              setServiceIds([]);
              setGarageId("");
            }}
            className={inputCls}
          >
            {BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        {bucketServices.length > 0 ? (
          <fieldset className="mt-3">
            <span className={labelCls}>Items (optional — ops can quote later)</span>
            <ul className="mt-1 flex flex-col gap-1">
              {bucketServices.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    {s.name}
                    <span className="ms-auto tabular text-xs text-muted-foreground">
                      {s.isQuoted ? "On quote" : `₹${s.basePrice}`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vehicle (optional)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Type</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as "" | "car" | "bike")}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="car">Car</option>
              <option value="bike">Bike</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Brand</span>
            <input value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Model</span>
            <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Registration</span>
            <input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className={`${inputCls} tabular`} />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Scheduling & garage (optional)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Slot label</span>
            <input
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              placeholder="e.g. Tomorrow 10 AM"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Garage (assign now, or later)</span>
            <select
              value={garageId}
              onChange={(e) => setGarageId(e.target.value)}
              className={inputCls}
            >
              <option value="">Leave unassigned</option>
              {bucketGarages.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Payment</span>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as "cash" | "upi")}
              className={inputCls}
            >
              <option value="cash">Cash on visit</option>
              <option value="upi">UPI</option>
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-ignite-100 bg-ignite-50 p-3 text-sm text-ignite-900">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="h-10 w-full rounded-md bg-pulse-600 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create booking"}
      </button>
    </div>
  );
}
