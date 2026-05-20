"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import { PhotoUpload } from "@/components/booking/PhotoUpload";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

/**
 * /denting — photo upload + description + panel picker (per design 8).
 *
 * Login is required HERE (not at the end) because we need the phone
 * number to deliver quotes back to (locked Q1 — denting exception).
 *
 * On submit: writes intake into draft and routes to /denting/quotes/[id].
 */

const PANELS = [
  { id: "front", label: "Front bumper" },
  { id: "rear", label: "Rear bumper" },
  { id: "left-front", label: "Left front door" },
  { id: "right-front", label: "Right front door" },
  { id: "left-rear", label: "Left rear door" },
  { id: "right-rear", label: "Right rear door" },
  { id: "bonnet", label: "Bonnet / Hood" },
  { id: "boot", label: "Boot / Trunk" },
  { id: "left-side", label: "Left side panel" },
  { id: "right-side", label: "Right side panel" },
];

export default function DentingIntakePage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();
  const { isAuthed, hydrated: authHydrated } = useAuth();
  const [description, setDescription] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const [panels, setPanels] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "denting") {
      update({
        bucket: "denting",
        serviceIds: [],
        garageId: undefined,
        slot: undefined,
        denting: undefined,
      });
    } else if (draft.denting) {
      setDescription(draft.denting.description ?? "");
      setPanels(draft.denting.panels ?? []);
    }
  }, [hydrated, draft.bucket, draft.denting, update]);

  const canSubmit = description.trim().length > 0 && photoCount >= 1;

  function togglePanel(id: string) {
    setPanels((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    if (!authHydrated) return;

    if (!isAuthed) {
      // For Denting we need the phone BEFORE we send to garages — login mid-flow.
      const next = "/denting"; // come back to resubmit after login
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    startTransition(async () => {
      // Mock fan-out delay
      await new Promise((r) => setTimeout(r, 900));
      const reqId = `Q-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      update({
        bucket: "denting",
        denting: { description, photoCount, panels },
      });
      router.push(`/denting/quotes/${reqId}`);
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <Link
            href="/"
            aria-label="Back to home"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        }
        title={<span>Denting & Painting</span>}
      />
      <ActiveJobBar />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">Show us the damage.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll send your photos to up to 3 nearby body shops. Quotes back via WhatsApp
            within 24 hours.
          </p>

          <Section title="Describe what happened">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="e.g. Hit a pole on driver side, dented the door."
              className="w-full resize-none rounded-md border border-input bg-card p-3 text-base text-foreground outline-none placeholder:text-steel-300 focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {description.length}/300
            </p>
          </Section>

          <Section title="Photos (1–6)">
            <PhotoUpload onChange={(count) => setPhotoCount(count)} />
          </Section>

          <Section title="Panels affected (optional)">
            <div className="grid grid-cols-2 gap-2">
              {PANELS.map((p) => {
                const isOn = panels.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePanel(p.id)}
                    aria-pressed={isOn}
                    className={cn(
                      "tap flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors active:scale-[0.99]",
                      isOn
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-card hover:border-steel-300",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{p.label}</span>
                    {isOn ? (
                      <Check className="size-4 text-primary" strokeWidth={2.5} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      </main>

      <BottomCTA>
        <Button onClick={handleSubmit} loading={isPending} disabled={!canSubmit}>
          {isAuthed ? "Send to garages ›" : "Sign in & send ›"}
        </Button>
      </BottomCTA>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
