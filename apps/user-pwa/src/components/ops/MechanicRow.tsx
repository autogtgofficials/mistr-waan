"use client";

import { useState, useTransition } from "react";
import { Phone, MessageCircle, MapPin, ExternalLink } from "lucide-react";
import { StatusBadge, statusLabel } from "./StatusBadge";
import { ServiceTag } from "./ServiceTag";
import {
  ONBOARDING_STATUSES,
  type Mechanic,
  type OnboardingStatus,
} from "@/lib/mechanics/types";
import { cn } from "@/lib/utils";

export function MechanicRow({ mechanic: initial }: { mechanic: Mechanic }) {
  const [m, setM] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(initial.notes ?? "");

  async function patch(patch: { onboardingStatus?: OnboardingStatus; notes?: string | null }) {
    const res = await fetch(`/api/mechanics/${encodeURIComponent(m.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.error("update failed", await res.text());
      return;
    }
    const next = (await res.json()) as Mechanic;
    setM(next);
  }

  const phone = m.phones[0];
  const whatsappHref = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : null;
  const callHref = phone ? `tel:${phone}` : null;
  const mapHref = `https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=18/${m.lat}/${m.lng}`;
  const services = m.services.filter((s) => s !== "unknown");

  return (
    <article
      className={cn(
        "rounded-md border border-border bg-card p-4 shadow-xs transition-opacity",
        pending && "opacity-60",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground truncate">{m.name}</h3>
          {m.address ? (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{m.address}</p>
          ) : null}
        </div>
        <StatusBadge status={m.onboardingStatus} />
      </header>

      {services.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {services.map((s) => (
            <ServiceTag key={s} service={s} />
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        {phone ? (
          <>
            <a
              href={callHref!}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-foreground hover:bg-muted"
            >
              <Phone className="size-3.5" strokeWidth={2} />
              {phone}
            </a>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-aqua-200 bg-aqua-50 px-2 py-1 text-aqua-700 hover:bg-aqua-100"
              >
                <MessageCircle className="size-3.5" strokeWidth={2} />
                WhatsApp
              </a>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground italic">no phone in OSM</span>
        )}

        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <MapPin className="size-3.5" strokeWidth={2} />
          {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
          <ExternalLink className="size-3" strokeWidth={2} />
        </a>

        {m.website ? (
          <a
            href={m.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            website
            <ExternalLink className="size-3" strokeWidth={2} />
          </a>
        ) : null}
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
        <label className="text-xs text-muted-foreground">Status:</label>
        <select
          value={m.onboardingStatus}
          onChange={(e) =>
            startTransition(() =>
              patch({ onboardingStatus: e.target.value as OnboardingStatus }),
            )
          }
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground focus:ring-2 focus:ring-ring"
        >
          {ONBOARDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="ms-auto rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
        >
          {notesOpen ? "Hide notes" : m.notes ? "Notes ✓" : "+ Notes"}
        </button>
      </footer>

      {notesOpen ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            placeholder="Outreach notes — who answered, when to call back, terms discussed..."
            className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground placeholder:text-steel-300 focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNotesDraft(m.notes ?? "");
                setNotesOpen(false);
              }}
              className="rounded-md border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await patch({ notes: notesDraft || null });
                  setNotesOpen(false);
                })
              }
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-pulse-600"
            >
              Save
            </button>
          </div>
        </div>
      ) : m.notes ? (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {m.notes}
        </p>
      ) : null}
    </article>
  );
}
