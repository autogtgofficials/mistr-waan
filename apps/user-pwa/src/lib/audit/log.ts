import "server-only";
import { useBlobs } from "@/lib/runtime";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditEntry } from "./types";

const FS_PATH = join(process.cwd(), "data", "audit-log.ndjson");
const BLOBS_STORE = "audit-log";

async function fsAppend(entry: AuditEntry): Promise<void> {
  await mkdir(dirname(FS_PATH), { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  await writeFile(FS_PATH, line, { flag: "a" });
}

async function fsRead(limit: number): Promise<AuditEntry[]> {
  if (!existsSync(FS_PATH)) return [];
  const raw = await readFile(FS_PATH, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .reverse()
    .map((l) => JSON.parse(l) as AuditEntry);
}

async function blobsAppend(entry: AuditEntry): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.set(entry.id, JSON.stringify(entry));
}

async function blobsRead(limit: number): Promise<AuditEntry[]> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  const { blobs } = await store.list();
  const entries = await Promise.all(
    blobs.map(async ({ key }: { key: string }) => {
      const raw = await store.get(key, { type: "text" });
      if (!raw) return null;
      try {
        return JSON.parse(raw) as AuditEntry;
      } catch {
        return null;
      }
    }),
  );
  return (entries.filter(Boolean) as AuditEntry[])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

const isNetlify = useBlobs();

export async function appendAuditEntry(
  fields: Omit<AuditEntry, "id" | "at">,
): Promise<void> {
  const entry: AuditEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...fields,
  };
  try {
    if (isNetlify) {
      await blobsAppend(entry);
    } else {
      await fsAppend(entry);
    }
  } catch (err) {
    console.error("[audit] failed to write entry", entry.id, err);
  }
}

export async function getAuditEntries(limit = 200): Promise<AuditEntry[]> {
  return isNetlify ? blobsRead(limit) : fsRead(limit);
}
