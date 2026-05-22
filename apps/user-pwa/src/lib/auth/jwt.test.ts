// @vitest-environment node
// jose@6 ships only the webapi build, which fails under jsdom because jsdom's
// Uint8Array isn't the same constructor as Node's (cross-realm instanceof bug).
// All JWT signing happens server-side in production anyway, so node env is
// the truer test environment.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cookieMaxAgeFor, cookieNameFor, signSession, verifySession } from "./jwt";

const ORIGINAL_SECRET = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-for-vitest-32-chars-min-aaaaaa";
});

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET;
});

describe("signSession / verifySession", () => {
  it("round-trips a customer session", async () => {
    const token = await signSession({
      sub: "profile-123",
      role: "customer",
      phone: "+917889686682",
    });
    const payload = await verifySession(token);
    expect(payload?.sub).toBe("profile-123");
    expect(payload?.role).toBe("customer");
    expect(payload?.phone).toBe("+917889686682");
  });

  it("round-trips a garage session", async () => {
    const token = await signSession({ sub: "garage-uuid", role: "garage", phone: "+91..." });
    const payload = await verifySession(token);
    expect(payload?.role).toBe("garage");
  });

  it("round-trips an ops session", async () => {
    const token = await signSession({ sub: "ops-uuid", role: "ops", email: "ops@example.com" });
    const payload = await verifySession(token);
    expect(payload?.role).toBe("ops");
    expect(payload?.email).toBe("ops@example.com");
  });

  it("returns null for a forged token (wrong secret)", async () => {
    const token = await signSession({ sub: "x", role: "customer" });
    process.env.JWT_SECRET = "different-secret-32-chars-min-aaaaaaa";
    const payload = await verifySession(token);
    expect(payload).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const token = await signSession({ sub: "x", role: "customer" }, { ttlSec: -1 });
    const payload = await verifySession(token);
    expect(payload).toBeNull();
  });

  it("returns null for garbage input", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("a.b.c")).toBeNull();
  });

  it("throws if JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    await expect(signSession({ sub: "x", role: "customer" })).rejects.toThrow(/JWT_SECRET/);
  });

  it("throws if JWT_SECRET is too short", async () => {
    process.env.JWT_SECRET = "too-short";
    await expect(signSession({ sub: "x", role: "customer" })).rejects.toThrow(/32 chars/);
  });
});

describe("cookieNameFor / cookieMaxAgeFor", () => {
  it("maps roles to cookie names", () => {
    expect(cookieNameFor("customer")).toBe("mw_session");
    expect(cookieNameFor("garage")).toBe("mw_garage_session");
    expect(cookieNameFor("ops")).toBe("mw_ops_session");
  });

  it("customer + garage get 30-day TTL, ops gets 12 hours", () => {
    expect(cookieMaxAgeFor("customer")).toBe(60 * 60 * 24 * 30);
    expect(cookieMaxAgeFor("garage")).toBe(60 * 60 * 24 * 30);
    expect(cookieMaxAgeFor("ops")).toBe(60 * 60 * 12);
  });
});
