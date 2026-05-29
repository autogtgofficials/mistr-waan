// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearPhotoRequest,
  getPhotoRequest,
  incrementPhotoRequestCount,
  setPhotoRequest,
} from "./photo-requests";

let tmp: string;
const cwdAtStart = process.cwd();
const PHONE = "+916006617842";

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "photoreq-"));
  process.chdir(tmp);
});
afterEach(() => {
  process.chdir(cwdAtStart);
  rmSync(tmp, { recursive: true, force: true });
});

describe("photo-request store", () => {
  it("returns null when no request exists", async () => {
    expect(await getPhotoRequest(PHONE)).toBeNull();
  });

  it("round-trips set → get with defaults", async () => {
    await setPhotoRequest({
      phone: PHONE,
      bookingId: "b-1",
      bookingShortId: "MW-AB23CD",
    });
    const got = await getPhotoRequest(PHONE);
    expect(got?.bookingId).toBe("b-1");
    expect(got?.maxPhotos).toBe(8);
    expect(got?.photosSoFar).toBe(0);
  });

  it("clear removes the request", async () => {
    await setPhotoRequest({ phone: PHONE, bookingId: "b-1", bookingShortId: "MW-AB23CD" });
    await clearPhotoRequest(PHONE);
    expect(await getPhotoRequest(PHONE)).toBeNull();
  });

  it("increments the counter and keeps the request below the cap", async () => {
    await setPhotoRequest({
      phone: PHONE,
      bookingId: "b-1",
      bookingShortId: "MW-AB23CD",
      maxPhotos: 3,
    });
    const after1 = await incrementPhotoRequestCount(PHONE);
    expect(after1?.photosSoFar).toBe(1);
    const stillThere = await getPhotoRequest(PHONE);
    expect(stillThere?.photosSoFar).toBe(1);
  });

  it("clears the request once the cap is reached", async () => {
    await setPhotoRequest({
      phone: PHONE,
      bookingId: "b-1",
      bookingShortId: "MW-AB23CD",
      maxPhotos: 2,
    });
    await incrementPhotoRequestCount(PHONE); // 1
    const final = await incrementPhotoRequestCount(PHONE); // 2 == cap
    expect(final?.photosSoFar).toBe(2);
    expect(await getPhotoRequest(PHONE)).toBeNull();
  });

  it("expires requests older than the 24h TTL", async () => {
    const aged = {
      phone: PHONE,
      bookingId: "b-1",
      bookingShortId: "MW-AB23CD",
      maxPhotos: 8,
      photosSoFar: 0,
      createdAt: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
    };
    mkdirSync("data", { recursive: true });
    writeFileSync("data/photo-requests.json", JSON.stringify({ [PHONE]: aged }));
    expect(await getPhotoRequest(PHONE)).toBeNull();
  });
});
