// Server-only data access for mechanics. Reads the scraped JSON and merges
// per-mechanic onboarding overrides on top so re-running the scraper doesn't
// nuke our outreach state.

import "server-only";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Mechanic, MechanicOverride, OnboardingStatus } from "./types";

const DATA_PATH = join(process.cwd(), "data", "mechanics.json");
const OVERRIDES_PATH = join(process.cwd(), "data", "overrides.json");

async function readOverrides(): Promise<Record<string, MechanicOverride>> {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    const raw = await readFile(OVERRIDES_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeOverrides(o: Record<string, MechanicOverride>) {
  await mkdir(dirname(OVERRIDES_PATH), { recursive: true });
  await writeFile(OVERRIDES_PATH, JSON.stringify(o, null, 2));
}

async function loadBase(): Promise<Mechanic[]> {
  const raw = await readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  const [base, overrides] = await Promise.all([loadBase(), readOverrides()]);
  return base.map((m) => {
    const o = overrides[m.id];
    if (!o) return m;
    return {
      ...m,
      onboardingStatus: o.onboardingStatus ?? m.onboardingStatus,
      notes: o.notes ?? m.notes,
      lastUpdatedAt: o.updatedAt,
    };
  });
}

export async function getMechanic(id: string): Promise<Mechanic | null> {
  const all = await getAllMechanics();
  return all.find((m) => m.id === id) ?? null;
}

export async function updateMechanic(
  id: string,
  patch: { onboardingStatus?: OnboardingStatus; notes?: string | null },
): Promise<Mechanic | null> {
  const base = (await loadBase()).find((m) => m.id === id);
  if (!base) return null;

  const overrides = await readOverrides();
  const existing = overrides[id] ?? { updatedAt: new Date().toISOString() };
  overrides[id] = {
    ...existing,
    ...(patch.onboardingStatus !== undefined
      ? { onboardingStatus: patch.onboardingStatus }
      : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeOverrides(overrides);
  return getMechanic(id);
}
