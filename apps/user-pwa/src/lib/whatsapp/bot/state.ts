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
  | "PICKING_BUCKET"
  | "PICKING_SERVICE"
  | "PICKING_DESCRIPTION"
  | "PICKING_SLOT"
  | "PICKING_PAYMENT"
  | "CONFIRMING";

export interface WizardState {
  phone: string;
  step: WizardStep;
  bucket?: "detailing" | "repairs" | "denting";
  /** Catalog ids picked (detailing only — repairs/denting use description). */
  serviceIds?: string[];
  /** Names mirrored for confirmation prompt readability. */
  serviceNames?: string[];
  /** Free-text problem statement for repairs/denting. */
  description?: string;
  slotLabel?: string;
  slotDate?: string | null;
  slotTime?: string | null;
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
