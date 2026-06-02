import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Database } from "@/lib/supabase/types";

/**
 * State store for the 12-step mechanic self-onboarding chatbot.
 *
 * Separate from the customer wizard's `state.ts` so the two flows never
 * collide on a single phone (a customer never onboards, a mechanic never
 * books). Keyed by E.164 phone, persisted to Netlify Blobs in prod and the
 * same `data/` FS pattern in dev.
 *
 * Idle TTL: 24 hours. Onboarding can pause/resume across hours.
 */

const BLOBS_STORE = "onboarding-state";
const TTL_MS = 24 * 60 * 60 * 1000;

function fsPath(): string {
  return join(process.cwd(), "data", "onboarding-state.json");
}

export type OnboardingStep =
  | "WORKSHOP_NAME"
  | "OWNER_NAME"
  | "AREA"
  | "SERVICES"
  | "RSA_YES_NO"
  | "RSA_RADIUS"
  | "PICKUP"
  | "HOURS"
  | "WEEKLY_OFF"
  | "VERIFICATION_DOC"
  | "PHONE_CONFIRM"
  | "SUBMITTED";

export type BookingBucket = Database["public"]["Enums"]["booking_bucket"];

export interface OnboardingState {
  phone: string;
  step: OnboardingStep;
  workshopName?: string;
  ownerName?: string;
  area?: string;
  serviceBuckets?: BookingBucket[];
  rsaAvailable?: boolean;
  rsaRadiusKm?: number;
  pickupAvailable?: boolean;
  workingHours?: string;
  weeklyOff?: string;
  /** Storage key under the `verification-docs` bucket once uploaded. */
  verificationDocPath?: string;
  /** The phone the mechanic confirmed (defaults to msg.from). */
  phoneConfirmed?: string;
  updatedAt: number;
}

type Table = Record<string, OnboardingState>;

function isNetlify(): boolean {
  return process.env.NETLIFY === "true";
}

async function fsRead(): Promise<Table> {
  if (!existsSync(fsPath())) return {};
  try {
    return JSON.parse(await readFile(fsPath(), "utf8")) as Table;
  } catch {
    return {};
  }
}

async function fsWrite(table: Table): Promise<void> {
  await mkdir(dirname(fsPath()), { recursive: true });
  await writeFile(fsPath(), JSON.stringify(table));
}

async function blobsGet(phone: string): Promise<OnboardingState | null> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  const raw = await store.get(phone, { type: "text" });
  return raw ? (JSON.parse(raw) as OnboardingState) : null;
}

async function blobsPut(state: OnboardingState): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.set(state.phone, JSON.stringify(state));
}

async function blobsDel(phone: string): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.delete(phone);
}

export async function getOnboardingState(phone: string): Promise<OnboardingState | null> {
  const s = isNetlify()
    ? await blobsGet(phone)
    : (await fsRead())[phone] ?? null;
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) {
    await clearOnboardingState(phone);
    return null;
  }
  return s;
}

export async function setOnboardingState(state: OnboardingState): Promise<void> {
  state.updatedAt = Date.now();
  if (isNetlify()) {
    await blobsPut(state);
  } else {
    const table = await fsRead();
    table[state.phone] = state;
    await fsWrite(table);
  }
}

export async function clearOnboardingState(phone: string): Promise<void> {
  if (isNetlify()) {
    await blobsDel(phone);
  } else {
    const table = await fsRead();
    delete table[phone];
    await fsWrite(table);
  }
}
