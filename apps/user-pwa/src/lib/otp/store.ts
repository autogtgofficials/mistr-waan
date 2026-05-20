import "server-only";
import { createHash, randomInt } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * OTP storage with hashed codes, 5-minute TTL, and 5-attempt limit per record.
 *
 * Dev → JSON file at data/otp-store.json (read/replace per request, fine at single-process scale).
 * Prod → Netlify Blobs (strong consistency, one blob per phone).
 *
 * Codes are never stored in plaintext. Verify hashes the candidate and compares.
 */

export const CODE_LENGTH = 6;
export const TTL_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

const BLOBS_STORE = "otp-store";

// Resolved at call time so tests can chdir into a temp dir per case.
function fsPath(): string {
  return join(process.cwd(), "data", "otp-store.json");
}

export interface OtpRecord {
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  channel: "whatsapp" | "sms";
  lastSentAt: number;
}

function isNetlify(): boolean {
  return process.env.NETLIFY === "true";
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  // randomInt is uniform; pad-left so leading zeros are preserved.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

// ── Filesystem backend ────────────────────────────────────────────────────────

type FsTable = Record<string, OtpRecord>;

async function fsRead(): Promise<FsTable> {
  if (!existsSync(fsPath())) return {};
  try {
    const raw = await readFile(fsPath(), "utf8");
    return JSON.parse(raw) as FsTable;
  } catch {
    return {};
  }
}

async function fsWrite(table: FsTable): Promise<void> {
  await mkdir(dirname(fsPath()), { recursive: true });
  await writeFile(fsPath(), JSON.stringify(table, null, 2));
}

async function fsGet(phone: string): Promise<OtpRecord | null> {
  const table = await fsRead();
  return table[phone] ?? null;
}

async function fsPut(record: OtpRecord): Promise<void> {
  const table = await fsRead();
  table[record.phone] = record;
  await fsWrite(table);
}

async function fsDel(phone: string): Promise<void> {
  const table = await fsRead();
  delete table[phone];
  await fsWrite(table);
}

// ── Netlify Blobs backend ─────────────────────────────────────────────────────

async function blobsGet(phone: string): Promise<OtpRecord | null> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  const raw = await store.get(phone, { type: "text" });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpRecord;
  } catch {
    return null;
  }
}

async function blobsPut(record: OtpRecord): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.set(record.phone, JSON.stringify(record));
}

async function blobsDel(phone: string): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.delete(phone);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getRecord(phone: string): Promise<OtpRecord | null> {
  return isNetlify() ? blobsGet(phone) : fsGet(phone);
}

async function putRecord(record: OtpRecord): Promise<void> {
  return isNetlify() ? blobsPut(record) : fsPut(record);
}

async function delRecord(phone: string): Promise<void> {
  return isNetlify() ? blobsDel(phone) : fsDel(phone);
}

export interface IssueResult {
  code: string;
  expiresAt: number;
}

export async function issueOtp(opts: {
  phone: string;
  channel: "whatsapp" | "sms";
  now?: number;
}): Promise<{ ok: true; result: IssueResult } | { ok: false; reason: "cooldown"; retryAfterMs: number }> {
  const now = opts.now ?? Date.now();
  const existing = await getRecord(opts.phone);
  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterMs: RESEND_COOLDOWN_MS - (now - existing.lastSentAt),
    };
  }
  const code = generateCode();
  const record: OtpRecord = {
    phone: opts.phone,
    codeHash: hashCode(code),
    expiresAt: now + TTL_MS,
    attempts: 0,
    channel: opts.channel,
    lastSentAt: now,
  };
  await putRecord(record);
  return { ok: true, result: { code, expiresAt: record.expiresAt } };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "wrong_code"; attemptsRemaining?: number };

export async function verifyOtp(opts: {
  phone: string;
  code: string;
  now?: number;
}): Promise<VerifyOutcome> {
  const now = opts.now ?? Date.now();
  const record = await getRecord(opts.phone);
  if (!record) return { ok: false, reason: "not_found" };
  if (now >= record.expiresAt) {
    await delRecord(opts.phone);
    return { ok: false, reason: "expired" };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await delRecord(opts.phone);
    return { ok: false, reason: "too_many_attempts" };
  }
  const candidateHash = hashCode(opts.code);
  if (candidateHash !== record.codeHash) {
    const next = { ...record, attempts: record.attempts + 1 };
    await putRecord(next);
    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - next.attempts);
    if (attemptsRemaining === 0) {
      await delRecord(opts.phone);
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "wrong_code", attemptsRemaining };
  }
  // Success — single-use.
  await delRecord(opts.phone);
  return { ok: true };
}

/** Test-only: nuke a record. Exposed for unit tests; safe in prod too. */
export async function clearOtp(phone: string): Promise<void> {
  await delRecord(phone);
}
