import "server-only";
import { useBlobs } from "@/lib/runtime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Tiny per-key rate limiter with a sliding window.
 *
 * Persistence parallels the OTP store:
 *   - dev: data/rate-limits.json (process-local, fine at single-process scale)
 *   - prod: Netlify Blobs
 *
 * Each entry is a list of recent hit timestamps. On `hit`, we drop timestamps
 * older than `windowMs`, check the count against `max`, and (if under)
 * append the new one.
 *
 * Not built for thread/process contention — the booking + OTP endpoints
 * run on Netlify functions where a single function instance handles each
 * request. Worst-case overshoot under contention is small and acceptable.
 */

const BLOBS_STORE = "rate-limits";

function fsPath(): string {
  return join(process.cwd(), "data", "rate-limits.json");
}

interface Entry {
  hits: number[]; // ms epoch
}
type Table = Record<string, Entry>;

function isNetlify(): boolean {
  return useBlobs();
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

async function blobsGet(key: string): Promise<Entry | null> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  const raw = await store.get(key, { type: "text" });
  return raw ? (JSON.parse(raw) as Entry) : null;
}

async function blobsPut(key: string, entry: Entry): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.set(key, JSON.stringify(entry));
}

export interface RateLimitOpts {
  /** Cap on hits in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check + record one hit against the given key. Returns whether the request
 * is allowed, the count left in the window, and when the window resets
 * (so callers can return a Retry-After hint).
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let entry: Entry;
  if (isNetlify()) {
    entry = (await blobsGet(key)) ?? { hits: [] };
  } else {
    const table = await fsRead();
    entry = table[key] ?? { hits: [] };
  }

  const recent = entry.hits.filter((t) => t > cutoff);
  if (recent.length >= opts.max) {
    const resetAt = (recent[0] ?? now) + opts.windowMs;
    return { ok: false, remaining: 0, resetAt };
  }
  recent.push(now);

  if (isNetlify()) {
    await blobsPut(key, { hits: recent });
  } else {
    const table = await fsRead();
    table[key] = { hits: recent };
    await fsWrite(table);
  }

  const resetAt = (recent[0] ?? now) + opts.windowMs;
  return { ok: true, remaining: opts.max - recent.length, resetAt };
}
