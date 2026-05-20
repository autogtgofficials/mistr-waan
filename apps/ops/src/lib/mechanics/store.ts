// Persistence for mechanic overrides. On Netlify we use Blobs (server-side
// kv that survives across deploys); locally we use a JSON file under data/.

import "server-only";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MechanicOverride } from "./types";

export interface OverrideStore {
  getAll(): Promise<Record<string, MechanicOverride>>;
  get(id: string): Promise<MechanicOverride | null>;
  set(id: string, value: MechanicOverride): Promise<void>;
}

const FS_PATH = join(process.cwd(), "data", "overrides.json");

class FilesystemStore implements OverrideStore {
  private cache: Record<string, MechanicOverride> | null = null;

  async getAll() {
    if (this.cache) return this.cache;
    if (!existsSync(FS_PATH)) {
      this.cache = {};
      return this.cache;
    }
    try {
      const raw = await readFile(FS_PATH, "utf8");
      this.cache = JSON.parse(raw);
      return this.cache!;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  async get(id: string) {
    const all = await this.getAll();
    return all[id] ?? null;
  }

  async set(id: string, value: MechanicOverride) {
    const all = await this.getAll();
    all[id] = value;
    this.cache = all;
    await mkdir(dirname(FS_PATH), { recursive: true });
    await writeFile(FS_PATH, JSON.stringify(all, null, 2));
  }
}

type NetlifyStore = Awaited<
  ReturnType<typeof import("@netlify/blobs").getStore>
>;

class BlobsStore implements OverrideStore {
  private storeP: Promise<NetlifyStore> | null = null;

  private store(): Promise<NetlifyStore> {
    if (this.storeP) return this.storeP;
    const p = (async () => {
      const { getStore } = await import("@netlify/blobs");
      return getStore({ name: "mechanic-overrides", consistency: "strong" });
    })();
    this.storeP = p;
    return p;
  }

  async getAll() {
    const s = await this.store();
    const { blobs } = await s.list();
    const entries = await Promise.all(
      blobs.map(async ({ key }) => {
        const raw = await s.get(key, { type: "text" });
        if (!raw) return null;
        try {
          return [key, JSON.parse(raw) as MechanicOverride] as const;
        } catch {
          return null;
        }
      }),
    );
    const out: Record<string, MechanicOverride> = {};
    for (const e of entries) if (e) out[e[0]] = e[1];
    return out;
  }

  async get(id: string) {
    const s = await this.store();
    const raw = await s.get(id, { type: "text" });
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MechanicOverride;
    } catch {
      return null;
    }
  }

  async set(id: string, value: MechanicOverride) {
    const s = await this.store();
    await s.set(id, JSON.stringify(value));
  }
}

let cached: OverrideStore | null = null;

export function getOverrideStore(): OverrideStore {
  if (cached) return cached;
  // Netlify sets NETLIFY=true at build & runtime.
  cached = process.env.NETLIFY === "true" ? new BlobsStore() : new FilesystemStore();
  return cached;
}

export function isPersistenceWritable(): boolean {
  // Both filesystems (dev) and Blobs (prod on Netlify) are writable.
  // Other hosts (e.g. Vercel) without Blobs would not be — current usage is
  // always one of the two so always true.
  return true;
}
