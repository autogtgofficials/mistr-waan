"use client";

import { FormEvent, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_STATUSES,
  SERVICE_TAG_LABELS,
  SERVICE_TAGS,
  type Mechanic,
  type OnboardingStatus,
  type ServiceTag,
} from "@/lib/mechanics/types";

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  interested: "Interested",
  onboarded: "Onboarded",
  declined: "Declined",
};

export function AddMechanicModal({
  knownAreas,
  onClose,
  onAdded,
}: {
  knownAreas: string[];
  onClose: () => void;
  onAdded: (m: Mechanic) => void;
}) {
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phones, setPhones] = useState<string[]>(["", ""]);
  const [area, setArea] = useState("");
  const [services, setServices] = useState<Set<ServiceTag>>(new Set());
  const [status, setStatus] = useState<OnboardingStatus>("not_contacted");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleService(s: ServiceTag) {
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function addPhone() {
    setPhones((p) => [...p, ""]);
  }

  function removePhone(i: number) {
    setPhones((p) => p.filter((_, idx) => idx !== i));
  }

  function setPhone(i: number, val: string) {
    setPhones((p) => p.map((v, idx) => (idx === i ? val : v)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const filledPhones = phones.map((p) => p.trim()).filter(Boolean);
    if (!shopName.trim() && !name.trim()) {
      setError("Shop name or owner name is required.");
      return;
    }
    if (filledPhones.length === 0) {
      setError("At least one phone number is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mechanics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          shopName: shopName.trim() || undefined,
          phones: filledPhones,
          area: area.trim() || undefined,
          services: [...services],
          onboardingStatus: status,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to add mechanic.");
        return;
      }
      const mechanic = (await res.json()) as Mechanic;
      onAdded(mechanic);
      onClose();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add mechanic</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manually onboard a garage not in the OSM dataset
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            {/* Shop & owner */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Basic info
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">
                    Shop name
                  </span>
                  <input
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Al-Noor Auto Workshop"
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">
                    Owner name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mushtaq Bhat"
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            </section>

            {/* Phone numbers */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Phone numbers <span className="text-danger">*</span>
              </h3>
              <div className="space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={p}
                      onChange={(e) => setPhone(i, e.target.value)}
                      placeholder="+91 94191 00000"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                    />
                    {phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhone(i)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPhone}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-pulse-600 hover:underline"
                >
                  <Plus className="size-3.5" />
                  Add another number
                </button>
              </div>
            </section>

            {/* Area */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location
              </h3>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Area</span>
                <input
                  list="known-areas"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Lal Chowk"
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
                <datalist id="known-areas">
                  {knownAreas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </label>
            </section>

            {/* Services */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Services
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {SERVICE_TAGS.filter((s) => s !== "unknown").map((s) => (
                  <label
                    key={s}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={services.has(s)}
                      onChange={() => toggleService(s)}
                      className="rounded border-input accent-primary"
                    />
                    {SERVICE_TAG_LABELS[s]}
                  </label>
                ))}
              </div>
            </section>

            {/* Pipeline status + notes */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pipeline
              </h3>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Initial status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OnboardingStatus)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {ONBOARDING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any context about this mechanic…"
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none"
                />
              </label>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border bg-background px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              {saving ? "Adding…" : "Add mechanic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
