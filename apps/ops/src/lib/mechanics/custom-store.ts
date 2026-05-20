// Persistence for manually added mechanics — same FilesystemStore/BlobsStore
// pattern as the overrides store.

import "server-only";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Mechanic } from "./types";

export interface CustomMechanicsStore {
  getAll(): Promise<Mechanic[]>;
  set(id: string, mechanic: Mechanic): Promise<void>;
}

const FS_PATH = join(process.cwd(), "data", "custom-mechanics.json");

class FilesystemStore implements CustomMechanicsStore {
  private cache: Mechanic[] | null = null;

  async getAll() {
    if (this.cache) return this.cache;
    if (!existsSync(FS_PATH)) {
      this.cache = [];
      return this.cache;
    }
    try {
      const raw = await readFile(FS_PATH, "utf8");
      this.cache = JSON.parse(raw) as Mechanic[];
      return this.cache;
    } catch {
      this.cache = [];
      return this.cache;
    }
  }

  async set(id: string, mechanic: Mechanic) {
    const all = await this.getAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx >= 0) {
      all[idx] = mechanic;
    } else {
      all.push(mechanic);
    }
    this.cache = all;
    await mkdir(dirname(FS_PATH), { recursive: true });
    await writeFile(FS_PATH, JSON.stringify(all, null, 2));
  }
}

type NetlifyStore = Awaited<ReturnType<typeof import("@netlify/blobs").getStore>>;

class BlobsStore implements CustomMechanicsStore {
  private storeP: Promise<NetlifyStore> | null = null;

  private store(): Promise<NetlifyStore> {
    if (this.storeP) return this.storeP;
    const p = (async () => {
      const { getStore } = await import("@netlify/blobs");
      return getStore({ name: "custom-mechanics", consistency: "strong" });
    })();
    this.storeP = p;
    return p;
  }

  async getAll() {
    const s = await this.store();
    const raw = await s.get("all", { type: "text" });
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Mechanic[];
    } catch {
      return [];
    }
  }

  async set(id: string, mechanic: Mechanic) {
    const all = await this.getAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx >= 0) {
      all[idx] = mechanic;
    } else {
      all.push(mechanic);
    }
    const s = await this.store();
    await s.set("all", JSON.stringify(all));
  }
}

let cached: CustomMechanicsStore | null = null;

export function getCustomMechanicsStore(): CustomMechanicsStore {
  if (cached) return cached;
  cached = process.env.NETLIFY === "true" ? new BlobsStore() : new FilesystemStore();
  return cached;
}
