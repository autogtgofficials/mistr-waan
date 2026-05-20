// Server-only data access for mechanics. Reads the scraped JSON and merges
// per-mechanic overrides on top so re-running the scraper doesn't nuke our
// outreach state.

import "server-only";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getOverrideStore } from "./store";
import { getCustomMechanicsStore } from "./custom-store";
import type {
  CallAttempt,
  Mechanic,
  MechanicOverride,
  MechanicPatch,
  OnboardingStatus,
  ServiceTag,
} from "./types";

export type NewMechanicInput = {
  name?: string;
  shopName?: string;
  phones: string[];
  area?: string;
  services?: ServiceTag[];
  notes?: string;
  onboardingStatus?: OnboardingStatus;
  lat?: number;
  lng?: number;
};

const DATA_PATH = join(process.cwd(), "data", "mechanics.json");

let baseCache: Mechanic[] | null = null;

async function loadBase(): Promise<Mechanic[]> {
  if (baseCache) return baseCache;
  const raw = await readFile(DATA_PATH, "utf8");
  baseCache = JSON.parse(raw);
  return baseCache!;
}

function applyOverride(m: Mechanic, o: MechanicOverride | undefined): Mechanic {
  if (!o) return m;
  return {
    ...m,
    onboardingStatus: o.onboardingStatus ?? m.onboardingStatus,
    notes: o.notes ?? m.notes,
    outreachOutcome: o.outreachOutcome ?? m.outreachOutcome,
    detailedServices: o.detailedServices ?? m.detailedServices,
    pricing: o.pricing ?? m.pricing,
    coverageAreas: o.coverageAreas ?? m.coverageAreas,
    businessProfile: o.businessProfile ?? m.businessProfile,
    callLog: o.callLog ?? m.callLog,
    nextFollowUpAt: o.nextFollowUpAt ?? m.nextFollowUpAt,
    nextFollowUpNote: o.nextFollowUpNote ?? m.nextFollowUpNote,
    tags: o.tags ?? m.tags,
    lastUpdatedAt: o.updatedAt,
  };
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  const [base, custom, overrides] = await Promise.all([
    loadBase(),
    getCustomMechanicsStore().getAll(),
    getOverrideStore().getAll(),
  ]);
  return [
    ...base.map((m) => applyOverride(m, overrides[m.id])),
    ...custom.map((m) => applyOverride(m, overrides[m.id])),
  ];
}

export async function createMechanic(input: NewMechanicInput): Promise<Mechanic> {
  const id = `manual-${randomUUID()}`;
  const now = new Date().toISOString();
  const mechanic: Mechanic = {
    id,
    source: "manual",
    osmType: "node",
    name: input.name ?? input.shopName ?? "",
    shopName: input.shopName ?? null,
    phones: input.phones,
    email: null,
    website: null,
    address: input.area ?? null,
    area: input.area ?? null,
    lat: input.lat ?? 34.0837,
    lng: input.lng ?? 74.7973,
    services: input.services ?? [],
    openingHours: null,
    rating: null,
    reviewCount: null,
    onboardingStatus: input.onboardingStatus ?? "not_contacted",
    notes: input.notes ?? null,
    rawTags: {},
    scrapedAt: now,
    lastUpdatedAt: now,
  };
  await getCustomMechanicsStore().set(id, mechanic);
  return mechanic;
}

export async function getMechanic(id: string): Promise<Mechanic | null> {
  const [base, override] = await Promise.all([
    loadBase(),
    getOverrideStore().get(id),
  ]);
  const m = base.find((b) => b.id === id);
  if (!m) return null;
  return applyOverride(m, override ?? undefined);
}

function mergeOverride(
  existing: MechanicOverride | null,
  patch: MechanicPatch,
): MechanicOverride {
  const base = existing ?? { updatedAt: new Date().toISOString() };
  return {
    ...base,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export async function patchMechanic(
  id: string,
  patch: MechanicPatch,
): Promise<Mechanic | null> {
  const base = (await loadBase()).find((m) => m.id === id);
  if (!base) return null;

  const store = getOverrideStore();
  const existing = await store.get(id);
  const merged = mergeOverride(existing, patch);
  await store.set(id, merged);
  return applyOverride(base, merged);
}

export async function appendCallAttempt(
  id: string,
  attempt: Omit<CallAttempt, "id" | "at"> & { at?: string; id?: string },
): Promise<Mechanic | null> {
  const base = (await loadBase()).find((m) => m.id === id);
  if (!base) return null;

  const store = getOverrideStore();
  const existing = await store.get(id);
  const callLog = existing?.callLog ?? [];
  const entry: CallAttempt = {
    id: attempt.id ?? randomUUID(),
    at: attempt.at ?? new Date().toISOString(),
    channel: attempt.channel,
    outcome: attempt.outcome,
    spokeWith: attempt.spokeWith,
    durationMin: attempt.durationMin,
    notes: attempt.notes,
    nextActionAt: attempt.nextActionAt,
    nextActionNote: attempt.nextActionNote,
    createdBy: attempt.createdBy,
  };

  // Derive coarse onboarding status from outcome so the existing list/coverage
  // views stay coherent without the caller having to set both.
  const derivedStatus = deriveOnboardingStatus(
    existing?.onboardingStatus ?? base.onboardingStatus,
    attempt.outcome,
  );

  const merged: MechanicOverride = mergeOverride(existing, {
    callLog: [...callLog, entry],
    outreachOutcome: attempt.outcome,
    onboardingStatus: derivedStatus,
    nextFollowUpAt: attempt.nextActionAt ?? existing?.nextFollowUpAt ?? null,
    nextFollowUpNote: attempt.nextActionNote ?? existing?.nextFollowUpNote ?? null,
  });

  await store.set(id, merged);
  return applyOverride(base, merged);
}

function deriveOnboardingStatus(
  current: Mechanic["onboardingStatus"],
  outcome: CallAttempt["outcome"],
): Mechanic["onboardingStatus"] {
  // Don't downgrade a hard "onboarded" or "declined" unless explicitly reset.
  if (current === "onboarded" && outcome !== "declined" && outcome !== "declined_dnc") {
    return "onboarded";
  }
  switch (outcome) {
    case "agreed":
    case "verbal_yes":
    case "conditional_yes":
      return "onboarded";
    case "interested":
    case "wants_meeting":
    case "wants_to_consult":
    case "callback_scheduled":
    case "skeptical":
    case "negotiating":
      return "interested";
    case "declined":
    case "declined_dnc":
    case "wants_kickback":
    case "competitor_engaged":
      return "declined";
    case "permanently_closed":
      return "declined";
    default:
      return "contacted";
  }
}
