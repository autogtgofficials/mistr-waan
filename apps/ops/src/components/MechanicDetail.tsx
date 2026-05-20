"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Phone,
  MessageCircle,
  MapPin,
  ExternalLink,
  X,
  Plus,
  CalendarClock,
  Mail,
  Building2,
  Users,
  Wrench,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, statusLabel } from "./StatusBadge";
import { OutcomeBadge, OUTCOME_LABELS } from "./OutcomeBadge";
import {
  CONTACT_CHANNELS,
  DETAILED_SERVICE_GROUPS,
  DETAILED_SERVICE_LABELS,
  ONBOARDING_STATUSES,
  OUTREACH_OUTCOMES,
  OUTCOME_BUCKETS,
  type CallAttempt,
  type ContactChannel,
  type DetailedService,
  type Mechanic,
  type MechanicPatch,
  type OnboardingStatus,
  type OutreachOutcome,
  type ServicePricing,
} from "@/lib/mechanics/types";

export function MechanicDetail({
  mechanic,
  knownAreas,
  onClose,
  onUpdated,
}: {
  mechanic: Mechanic;
  knownAreas: string[];
  onClose: () => void;
  onUpdated: (m: Mechanic) => void;
}) {
  const [m, setM] = useState(mechanic);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setM(mechanic), [mechanic]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(p: MechanicPatch) {
    const res = await fetch(`/api/mechanics/${encodeURIComponent(m.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      setError(`Save failed: ${await res.text()}`);
      return;
    }
    setError(null);
    const next = (await res.json()) as Mechanic;
    setM(next);
    onUpdated(next);
  }

  async function logCall(attempt: Omit<CallAttempt, "id" | "at">) {
    const res = await fetch(
      `/api/mechanics/${encodeURIComponent(m.id)}/call-log`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
      },
    );
    if (!res.ok) {
      setError(`Log failed: ${await res.text()}`);
      return;
    }
    setError(null);
    const next = (await res.json()) as Mechanic;
    setM(next);
    onUpdated(next);
  }

  const phone = m.phones[0];

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close"
        className="flex-1 bg-steel-900/30"
        onClick={onClose}
      />
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-lg">
        {/* Sticky header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground truncate">{m.name}</h2>
              {m.address ? (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{m.address}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={m.onboardingStatus} />
                {m.outreachOutcome ? <OutcomeBadge outcome={m.outreachOutcome} /> : null}
                {m.nextFollowUpAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pulse-50 px-2 py-0.5 text-[11px] font-medium text-pulse-700">
                    <CalendarClock className="size-3" strokeWidth={2} />
                    Follow-up {formatRelativeDate(m.nextFollowUpAt)}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>

          {/* Quick contact bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {phone ? (
              <>
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-foreground hover:bg-muted"
                >
                  <Phone className="size-3.5" strokeWidth={2} />
                  {phone}
                </a>
                <a
                  href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-aqua-200 bg-aqua-50 px-2 py-1 text-aqua-700 hover:bg-aqua-100"
                >
                  <MessageCircle className="size-3.5" strokeWidth={2} />
                  WhatsApp
                </a>
              </>
            ) : (
              <span className="italic text-muted-foreground">no phone</span>
            )}
            <a
              href={`https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=18/${m.lat}/${m.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <MapPin className="size-3.5" strokeWidth={2} />
              Map
              <ExternalLink className="size-3" strokeWidth={2} />
            </a>
            {m.website ? (
              <a
                href={m.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                Website
                <ExternalLink className="size-3" strokeWidth={2} />
              </a>
            ) : null}
            {m.email ? (
              <a
                href={`mailto:${m.email}`}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Mail className="size-3.5" strokeWidth={2} />
                {m.email}
              </a>
            ) : null}
          </div>

          {error ? (
            <div className="mt-2 rounded-md border border-danger/40 bg-danger-soft px-2 py-1 text-xs text-danger">
              {error}
            </div>
          ) : null}
        </header>

        {/* Body */}
        <div className={cn("flex-1 space-y-6 overflow-y-auto px-5 py-5", pending && "opacity-70")}>
          <OutreachSection
            mechanic={m}
            onPatch={(p) => startTransition(() => patch(p))}
          />

          <LogCallSection
            knownContact={phone ?? null}
            onLog={(a) => startTransition(() => logCall(a))}
          />

          <ServicesSection
            mechanic={m}
            onPatch={(p) => startTransition(() => patch(p))}
          />

          <CoverageSection
            mechanic={m}
            knownAreas={knownAreas}
            onPatch={(p) => startTransition(() => patch(p))}
          />

          <ProfileSection
            mechanic={m}
            onPatch={(p) => startTransition(() => patch(p))}
          />

          <CallLogSection mechanic={m} />
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   Section: outreach status + outcome + follow-up + free notes
   ============================================================ */
function OutreachSection({
  mechanic: m,
  onPatch,
}: {
  mechanic: Mechanic;
  onPatch: (p: MechanicPatch) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(m.notes ?? "");
  const [followUpDraft, setFollowUpDraft] = useState(
    m.nextFollowUpAt ? toDateInputValue(m.nextFollowUpAt) : "",
  );
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState(m.nextFollowUpNote ?? "");

  useEffect(() => setNotesDraft(m.notes ?? ""), [m.notes]);
  useEffect(
    () => setFollowUpDraft(m.nextFollowUpAt ? toDateInputValue(m.nextFollowUpAt) : ""),
    [m.nextFollowUpAt],
  );
  useEffect(() => setFollowUpNoteDraft(m.nextFollowUpNote ?? ""), [m.nextFollowUpNote]);

  return (
    <Section title="Outreach" icon={<Users className="size-4" strokeWidth={2} />}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Pipeline status">
          <select
            value={m.onboardingStatus}
            onChange={(e) =>
              onPatch({ onboardingStatus: e.target.value as OnboardingStatus })
            }
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {ONBOARDING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Latest outcome">
          <OutcomeSelect
            value={m.outreachOutcome}
            onChange={(v) => onPatch({ outreachOutcome: v })}
          />
        </Field>

        <Field label="Next follow-up date">
          <input
            type="date"
            value={followUpDraft}
            onChange={(e) => setFollowUpDraft(e.target.value)}
            onBlur={() =>
              onPatch({
                nextFollowUpAt: followUpDraft
                  ? new Date(followUpDraft).toISOString()
                  : null,
              })
            }
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>

        <Field label="Follow-up reminder note">
          <input
            type="text"
            value={followUpNoteDraft}
            onChange={(e) => setFollowUpNoteDraft(e.target.value)}
            onBlur={() => onPatch({ nextFollowUpNote: followUpNoteDraft || null })}
            placeholder="e.g. ask for owner Imran"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
      </div>

      <Field label="Free notes" className="mt-3">
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => onPatch({ notes: notesDraft || null })}
          rows={3}
          placeholder="Anything that doesn't fit a field — context, gut feel, things to remember..."
          className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
        />
      </Field>
    </Section>
  );
}

/* ============================================================
   Section: log a call
   ============================================================ */
function LogCallSection({
  knownContact,
  onLog,
}: {
  knownContact: string | null;
  onLog: (a: Omit<CallAttempt, "id" | "at">) => void;
}) {
  const [channel, setChannel] = useState<ContactChannel>("phone");
  const [outcome, setOutcome] = useState<OutreachOutcome>("no_answer");
  const [spokeWith, setSpokeWith] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [nextActionDays, setNextActionDays] = useState("");
  const [nextActionNote, setNextActionNote] = useState("");

  function reset() {
    setSpokeWith("");
    setDuration("");
    setNotes("");
    setNextActionDays("");
    setNextActionNote("");
    setOutcome("no_answer");
  }

  function submit() {
    const nextActionAt = nextActionDays
      ? new Date(Date.now() + Number(nextActionDays) * 86400_000).toISOString()
      : undefined;
    onLog({
      channel,
      outcome,
      spokeWith: spokeWith || undefined,
      durationMin: duration ? Number(duration) : undefined,
      notes: notes || undefined,
      nextActionAt,
      nextActionNote: nextActionNote || undefined,
    });
    reset();
  }

  return (
    <Section
      title="Log a call attempt"
      icon={<Phone className="size-4" strokeWidth={2} />}
      tint="primary"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Channel">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ContactChannel)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {CONTACT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Outcome">
          <OutcomeSelect value={outcome} onChange={(v) => setOutcome(v)} />
        </Field>

        <Field label="Spoke with">
          <input
            type="text"
            value={spokeWith}
            onChange={(e) => setSpokeWith(e.target.value)}
            placeholder={knownContact ?? "name or role"}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>

        <Field label="Duration (min)">
          <input
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>

        <Field label="Call notes" className="sm:col-span-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="What was said, objections, vibe..."
            className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
          />
        </Field>

        <Field label="Next action — in N days">
          <input
            type="number"
            min={0}
            value={nextActionDays}
            onChange={(e) => setNextActionDays(e.target.value)}
            placeholder="e.g. 3"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>

        <Field label="Next action note">
          <input
            type="text"
            value={nextActionNote}
            onChange={(e) => setNextActionNote(e.target.value)}
            placeholder="What to do next"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-pulse-600"
        >
          <Plus className="size-4" strokeWidth={2} />
          Log attempt
        </button>
      </div>
    </Section>
  );
}

function channelLabel(c: ContactChannel) {
  switch (c) {
    case "phone":
      return "Phone";
    case "whatsapp":
      return "WhatsApp";
    case "in_person":
      return "In person";
    case "email":
      return "Email";
    case "other":
      return "Other";
  }
}

/* ============================================================
   Section: services + per-service pricing
   ============================================================ */
function ServicesSection({
  mechanic: m,
  onPatch,
}: {
  mechanic: Mechanic;
  onPatch: (p: MechanicPatch) => void;
}) {
  const selected = useMemo(
    () => new Set(m.detailedServices ?? []),
    [m.detailedServices],
  );
  const pricingMap = useMemo(() => {
    const map = new Map<DetailedService, ServicePricing>();
    for (const p of m.pricing ?? []) map.set(p.service, p);
    return map;
  }, [m.pricing]);

  function toggle(s: DetailedService, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(s);
    else next.delete(s);
    const services = [...next];
    // also drop pricing rows for de-selected services
    const pricing = (m.pricing ?? []).filter((p) => next.has(p.service));
    onPatch({ detailedServices: services, pricing });
  }

  function patchPricing(s: DetailedService, change: Partial<ServicePricing>) {
    const existing = pricingMap.get(s) ?? { service: s };
    const updated: ServicePricing = { ...existing, ...change, service: s };
    const others = (m.pricing ?? []).filter((p) => p.service !== s);
    onPatch({ pricing: [...others, updated] });
  }

  return (
    <Section title="Services & pricing" icon={<Wrench className="size-4" strokeWidth={2} />}>
      <p className="mb-3 text-xs text-muted-foreground">
        Tick what they offer. Add a price range only where you actually got numbers.
      </p>
      <div className="space-y-4">
        {DETAILED_SERVICE_GROUPS.map((group) => (
          <div key={group.label}>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h4>
            <div className="space-y-1.5">
              {group.services.map((s) => {
                const on = selected.has(s);
                const price = pricingMap.get(s);
                return (
                  <div
                    key={s}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-sm",
                      on ? "border-pulse-200 bg-pulse-50/40" : "border-border bg-card",
                    )}
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggle(s, e.target.checked)}
                      />
                      <span className="flex-1 text-foreground">
                        {DETAILED_SERVICE_LABELS[s]}
                      </span>
                    </label>
                    {on ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <PriceField
                          label="Min ₹"
                          value={price?.priceMin}
                          onBlur={(v) => patchPricing(s, { priceMin: v })}
                        />
                        <PriceField
                          label="Max ₹"
                          value={price?.priceMax}
                          onBlur={(v) => patchPricing(s, { priceMax: v })}
                        />
                        <Field label="Unit">
                          <select
                            value={price?.unit ?? ""}
                            onChange={(e) =>
                              patchPricing(s, {
                                unit:
                                  (e.target.value as ServicePricing["unit"]) ||
                                  undefined,
                              })
                            }
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                          >
                            <option value="">—</option>
                            <option value="per_visit">per visit</option>
                            <option value="per_hour">per hour</option>
                            <option value="per_part">per part</option>
                            <option value="starts_from">starts from</option>
                          </select>
                        </Field>
                        <Field label="Notes">
                          <input
                            type="text"
                            defaultValue={price?.notes ?? ""}
                            onBlur={(e) =>
                              patchPricing(s, { notes: e.target.value || undefined })
                            }
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                            placeholder="brand, condition..."
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PriceField({
  label,
  value,
  onBlur,
}: {
  label: string;
  value: number | undefined;
  onBlur: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");
  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = draft === "" ? undefined : Number(draft);
          onBlur(Number.isFinite(n as number) ? n : undefined);
        }}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground tabular"
      />
    </Field>
  );
}

/* ============================================================
   Section: coverage areas
   ============================================================ */
function CoverageSection({
  mechanic: m,
  knownAreas,
  onPatch,
}: {
  mechanic: Mechanic;
  knownAreas: string[];
  onPatch: (p: MechanicPatch) => void;
}) {
  const selected = useMemo(
    () => new Set(m.coverageAreas ?? []),
    [m.coverageAreas],
  );
  const [adding, setAdding] = useState("");

  function commit(next: Set<string>) {
    onPatch({ coverageAreas: [...next].sort((a, b) => a.localeCompare(b)) });
  }
  function toggle(a: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(a);
    else next.delete(a);
    commit(next);
  }
  function addCustom() {
    const name = adding.trim();
    if (!name) return;
    const next = new Set(selected);
    next.add(name);
    setAdding("");
    commit(next);
  }

  // Native area first, then everything else
  const ownArea = m.area;
  const ranked = useMemo(() => {
    const set = new Set<string>(knownAreas);
    if (ownArea) set.add(ownArea);
    for (const a of selected) set.add(a);
    return [...set].sort((a, b) => {
      if (a === ownArea) return -1;
      if (b === ownArea) return 1;
      const sa = selected.has(a) ? 0 : 1;
      const sb = selected.has(b) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });
  }, [knownAreas, ownArea, selected]);

  return (
    <Section title="Coverage areas" icon={<MapPin className="size-4" strokeWidth={2} />}>
      <p className="mb-3 text-xs text-muted-foreground">
        Where this mechanic actually serves customers. Their own location is{" "}
        <span className="font-medium text-foreground">{ownArea ?? "unknown"}</span>.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ranked.map((a) => {
          const on = selected.has(a);
          const isOwn = a === ownArea;
          return (
            <button
              key={a}
              type="button"
              onClick={() => toggle(a, !on)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                on
                  ? "border-pulse-300 bg-pulse-50 text-pulse-800"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {a}
              {isOwn ? (
                <span className="text-[10px] uppercase text-muted-foreground">home</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a custom area..."
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Add
        </button>
      </div>
    </Section>
  );
}

/* ============================================================
   Section: business profile
   ============================================================ */
function ProfileSection({
  mechanic: m,
  onPatch,
}: {
  mechanic: Mechanic;
  onPatch: (p: MechanicPatch) => void;
}) {
  const profile = m.businessProfile ?? {};
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);

  function commit() {
    onPatch({ businessProfile: stripEmpty(draft) });
  }

  return (
    <Section
      title="Business profile"
      icon={<Building2 className="size-4" strokeWidth={2} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Owner / contact name">
          <input
            type="text"
            value={draft.ownerName ?? ""}
            onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })}
            onBlur={commit}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <Field label="Role">
          <select
            value={draft.ownerRole ?? ""}
            onChange={(e) => {
              const role =
                (e.target.value as NonNullable<typeof draft.ownerRole>) || undefined;
              const next = { ...draft, ownerRole: role };
              setDraft(next);
              onPatch({ businessProfile: stripEmpty(next) });
            }}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">—</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="partner">Partner</option>
            <option value="staff">Staff</option>
          </select>
        </Field>
        <Field label="Decision maker (if not above)">
          <input
            type="text"
            value={draft.decisionMaker ?? ""}
            onChange={(e) => setDraft({ ...draft, decisionMaker: e.target.value })}
            onBlur={commit}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <Field label="Preferred contact channel">
          <select
            value={draft.preferredContact ?? ""}
            onChange={(e) => {
              const v =
                (e.target.value as ContactChannel) || undefined;
              const next = { ...draft, preferredContact: v };
              setDraft(next);
              onPatch({ businessProfile: stripEmpty(next) });
            }}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">—</option>
            {CONTACT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Years in business">
          <input
            type="number"
            min={0}
            value={draft.yearsInBusiness ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                yearsInBusiness: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            onBlur={commit}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground tabular"
          />
        </Field>
        <Field label="Number of bays / lifts">
          <input
            type="number"
            min={0}
            value={draft.numBays ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                numBays: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            onBlur={commit}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground tabular"
          />
        </Field>
        <Field label="Number of staff">
          <input
            type="number"
            min={0}
            value={draft.numStaff ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                numStaff: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            onBlur={commit}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground tabular"
          />
        </Field>
        <Field label="Avg vehicles / day">
          <input
            type="number"
            min={0}
            value={draft.dailyThroughput ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                dailyThroughput: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            onBlur={commit}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground tabular"
          />
        </Field>
        <Field label="Working hours">
          <input
            type="text"
            value={draft.workingHours ?? ""}
            onChange={(e) => setDraft({ ...draft, workingHours: e.target.value })}
            onBlur={commit}
            placeholder="e.g. 9 AM – 8 PM"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <Field label="Weekly off">
          <input
            type="text"
            value={draft.weeklyOff ?? ""}
            onChange={(e) => setDraft({ ...draft, weeklyOff: e.target.value })}
            onBlur={commit}
            placeholder="e.g. Sunday"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <Field label="Authorized brand(s) — comma separated" className="sm:col-span-2">
          <input
            type="text"
            value={(draft.authorizedBrands ?? []).join(", ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                authorizedBrands: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            onBlur={commit}
            placeholder="e.g. Maruti, Hyundai"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>

        <Field label="Languages spoken — comma separated" className="sm:col-span-2">
          <input
            type="text"
            value={(draft.languages ?? []).join(", ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                languages: e.target.value
                  .split(",")
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean) as NonNullable<typeof draft.languages>,
              })
            }
            onBlur={commit}
            placeholder="e.g. en, ur, ks"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </Field>

        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={!!draft.authorized}
            onChange={(e) => {
              const next = { ...draft, authorized: e.target.checked };
              setDraft(next);
              onPatch({ businessProfile: stripEmpty(next) });
            }}
          />
          Authorized service center
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={!!draft.multibrand}
            onChange={(e) => {
              const next = { ...draft, multibrand: e.target.checked };
              setDraft(next);
              onPatch({ businessProfile: stripEmpty(next) });
            }}
          />
          Multi-brand
        </label>
      </div>
    </Section>
  );
}

function stripEmpty<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

/* ============================================================
   Section: call log timeline
   ============================================================ */
function CallLogSection({ mechanic: m }: { mechanic: Mechanic }) {
  const log = (m.callLog ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  if (log.length === 0) {
    return (
      <Section title="Call log" icon={<History className="size-4" strokeWidth={2} />}>
        <p className="text-xs text-muted-foreground">
          No call attempts logged yet. Use “Log a call attempt” above after every contact.
        </p>
      </Section>
    );
  }
  return (
    <Section
      title={`Call log (${log.length})`}
      icon={<History className="size-4" strokeWidth={2} />}
    >
      <ol className="relative space-y-3 border-l border-border pl-4">
        {log.map((a) => (
          <li key={a.id} className="relative">
            <span
              className={cn(
                "absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-background",
                bucketDotColor(a.outcome),
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">
                {formatDateTime(a.at)}
              </span>
              <span>·</span>
              <span>{channelLabel(a.channel)}</span>
              {a.spokeWith ? (
                <>
                  <span>·</span>
                  <span>spoke with {a.spokeWith}</span>
                </>
              ) : null}
              {a.durationMin ? (
                <>
                  <span>·</span>
                  <span className="tabular">{a.durationMin} min</span>
                </>
              ) : null}
            </div>
            <div className="mt-1">
              <OutcomeBadge outcome={a.outcome} />
            </div>
            {a.notes ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{a.notes}</p>
            ) : null}
            {a.nextActionAt || a.nextActionNote ? (
              <p className="mt-1 text-xs text-pulse-700">
                <CalendarClock className="me-1 inline size-3" strokeWidth={2} />
                Next: {a.nextActionAt ? formatRelativeDate(a.nextActionAt) : ""}{" "}
                {a.nextActionNote ? `— ${a.nextActionNote}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function bucketDotColor(o: OutreachOutcome): string {
  switch (OUTCOME_BUCKETS[o]) {
    case "won":
      return "bg-green-500";
    case "warm":
      return "bg-aqua-500";
    case "lost":
      return "bg-danger";
    case "no_reach":
      return "bg-steel-300";
    case "edge":
      return "bg-steel-400";
  }
}

/* ============================================================
   Shared bits
   ============================================================ */
function Section({
  title,
  icon,
  tint,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  tint?: "primary";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border p-4",
        tint === "primary"
          ? "border-pulse-200 bg-pulse-50/30"
          : "border-border bg-card",
      )}
    >
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function OutcomeSelect({
  value,
  onChange,
}: {
  value: OutreachOutcome | undefined;
  onChange: (v: OutreachOutcome) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as OutreachOutcome)}
      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
    >
      {!value ? <option value="">—</option> : null}
      <optgroup label="Closed-won">
        {OUTREACH_OUTCOMES.filter((o) => OUTCOME_BUCKETS[o] === "won").map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Warm / open">
        {OUTREACH_OUTCOMES.filter((o) => OUTCOME_BUCKETS[o] === "warm").map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Closed-lost">
        {OUTREACH_OUTCOMES.filter((o) => OUTCOME_BUCKETS[o] === "lost").map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Couldn't reach">
        {OUTREACH_OUTCOMES.filter((o) => OUTCOME_BUCKETS[o] === "no_reach").map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Edge">
        {OUTREACH_OUTCOMES.filter((o) => OUTCOME_BUCKETS[o] === "edge").map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tgt = new Date(d);
  tgt.setHours(0, 0, 0, 0);
  const days = Math.round((tgt.getTime() - today.getTime()) / 86400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0 && days < 7) return `in ${days} days`;
  if (days < 0 && days > -7) return `${-days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

