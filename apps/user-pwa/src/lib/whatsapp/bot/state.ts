import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Wizard session state for the customer booking chatbot.
 *
 * Keyed by the customer's WhatsApp phone (in E.164). One active session
 * per phone — if the customer abandons mid-flow, the session expires
 * after `TTL_MS` and we treat the next message as a fresh start.
 *
 * Persistence mirrors the OTP + rate-limit stores:
 *   - dev: data/bot-state.json
 *   - prod: Netlify Blobs (`bot-state` store)
 */

const BLOBS_STORE = "bot-state";
const TTL_MS = 30 * 60 * 1000; // 30 minutes idle → reset

function fsPath(): string {
  return join(process.cwd(), "data", "bot-state.json");
}

export type WizardStep =
  // Phase 5 — blueprint-aligned steps prepended before the original ones.
  | "PICKING_MODULE"
  | "PICKING_VEHICLE_TYPE"
  | "PICKING_BUCKET"
  | "PICKING_SERVICE"
  | "PICKING_DESCRIPTION"
  | "PICKING_AREA"
  | "PICKING_GARAGE"
  | "PICKING_SLOT"
  | "PICKING_VEHICLE_DETAILS"
  | "PICKING_PAYMENT"
  | "CONFIRMING";

export type ServiceBucket =
  | "detailing"
  | "repairs"
  | "denting"
  | "scheduled_maintenance"
  | "rsa";

export type VehicleType = "car" | "bike";

/** Customer-facing module taxonomy (blueprint). Maps to one or more buckets. */
export type CustomerModule = "maintenance" | "rsa" | "additional";

export interface WizardState {
  phone: string;
  step: WizardStep;
  /** Top-level module the customer picked (Maintenance / RSA / Additional). */
  module?: CustomerModule;
  /** Vehicle type (car/bike). Captured early — applies to all modules. */
  vehicleType?: VehicleType;
  /** The bucket inferred from module + (for Additional) sub-pick. */
  bucket?: ServiceBucket;
  /** Catalog ids picked (when bucket has a fixed catalog). */
  serviceIds?: string[];
  /** Names mirrored for confirmation prompt readability. */
  serviceNames?: string[];
  /** Free-text problem statement (repairs / denting / RSA). */
  description?: string;
  /** Area the customer picked — must match an active garage's `area`. */
  area?: string;
  /** Garage id the customer picked from the in-area list. */
  garageId?: string;
  /** Garage name mirrored for the confirmation prompt. */
  garageName?: string;
  slotLabel?: string;
  slotDate?: string | null;
  slotTime?: string | null;
  /** Vehicle brand + model + optional registration (captured late in flow). */
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleRegistration?: string;
  paymentMode?: "cash" | "upi";
  updatedAt: number;
}

type Table = Record<string, WizardState>;

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

async function blobsGet(phone: string): Promise<WizardState | null> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  const raw = await store.get(phone, { type: "text" });
  return raw ? (JSON.parse(raw) as WizardState) : null;
}

async function blobsPut(state: WizardState): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.set(state.phone, JSON.stringify(state));
}

async function blobsDel(phone: string): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.delete(phone);
}

/**
 * Read a wizard session for a phone. Returns null if no session or expired.
 * Expired sessions are also cleared as a side effect.
 */
export async function getWizardState(phone: string): Promise<WizardState | null> {
  const s = isNetlify()
    ? await blobsGet(phone)
    : (await fsRead())[phone] ?? null;
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) {
    await clearWizardState(phone);
    return null;
  }
  return s;
}

export async function setWizardState(state: WizardState): Promise<void> {
  state.updatedAt = Date.now();
  if (isNetlify()) {
    await blobsPut(state);
  } else {
    const table = await fsRead();
    table[state.phone] = state;
    await fsWrite(table);
  }
}

export async function clearWizardState(phone: string): Promise<void> {
  if (isNetlify()) {
    await blobsDel(phone);
  } else {
    const table = await fsRead();
    delete table[phone];
    await fsWrite(table);
  }
}
