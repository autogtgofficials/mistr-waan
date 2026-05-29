import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Per-phone "I'm expecting photos for booking X" flag.
 *
 * When ops taps "Request photos" on the booking detail page, we:
 *   1. Send the customer a WhatsApp message asking for photos
 *   2. Set a PhotoRequest entry keyed by their phone with the bookingId
 *      + a 24-hour expiry + a max-photos cap
 *
 * When any image arrives on the webhook from that phone, the intent
 * router checks for an active request and uploads to Storage instead
 * of treating the image as "unknown intent".
 *
 * Persistence mirrors the other bot stores (FS dev / Netlify Blobs prod).
 */

const BLOBS_STORE = "photo-requests";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_PHOTOS_DEFAULT = 8;

function fsPath(): string {
  return join(process.cwd(), "data", "photo-requests.json");
}

export interface PhotoRequest {
  phone: string;
  bookingId: string;
  bookingShortId: string;
  maxPhotos: number;
  photosSoFar: number;
  /** ms epoch when the request was created. expires = createdAt + TTL_MS */
  createdAt: number;
}

type Table = Record<string, PhotoRequest>;

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

async function blobsGet(phone: string): Promise<PhotoRequest | null> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  const raw = await store.get(phone, { type: "text" });
  return raw ? (JSON.parse(raw) as PhotoRequest) : null;
}

async function blobsPut(req: PhotoRequest): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.set(req.phone, JSON.stringify(req));
}

async function blobsDel(phone: string): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: BLOBS_STORE, consistency: "strong" });
  await store.delete(phone);
}

export async function setPhotoRequest(opts: {
  phone: string;
  bookingId: string;
  bookingShortId: string;
  maxPhotos?: number;
}): Promise<PhotoRequest> {
  const req: PhotoRequest = {
    phone: opts.phone,
    bookingId: opts.bookingId,
    bookingShortId: opts.bookingShortId,
    maxPhotos: opts.maxPhotos ?? MAX_PHOTOS_DEFAULT,
    photosSoFar: 0,
    createdAt: Date.now(),
  };
  if (isNetlify()) {
    await blobsPut(req);
  } else {
    const table = await fsRead();
    table[opts.phone] = req;
    await fsWrite(table);
  }
  return req;
}

export async function getPhotoRequest(phone: string): Promise<PhotoRequest | null> {
  const req = isNetlify()
    ? await blobsGet(phone)
    : (await fsRead())[phone] ?? null;
  if (!req) return null;
  if (Date.now() - req.createdAt > TTL_MS) {
    await clearPhotoRequest(phone);
    return null;
  }
  return req;
}

export async function clearPhotoRequest(phone: string): Promise<void> {
  if (isNetlify()) {
    await blobsDel(phone);
  } else {
    const table = await fsRead();
    delete table[phone];
    await fsWrite(table);
  }
}

/** Bump photosSoFar by 1; clears the request when the cap is hit. */
export async function incrementPhotoRequestCount(
  phone: string,
): Promise<PhotoRequest | null> {
  const req = await getPhotoRequest(phone);
  if (!req) return null;
  const next = req.photosSoFar + 1;
  if (next >= req.maxPhotos) {
    await clearPhotoRequest(phone);
    return { ...req, photosSoFar: next };
  }
  const updated: PhotoRequest = { ...req, photosSoFar: next };
  if (isNetlify()) {
    await blobsPut(updated);
  } else {
    const table = await fsRead();
    table[phone] = updated;
    await fsWrite(table);
  }
  return updated;
}
