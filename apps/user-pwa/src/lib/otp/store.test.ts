import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CODE_LENGTH,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  TTL_MS,
  clearOtp,
  generateCode,
  issueOtp,
  verifyOtp,
} from "./store";

const PHONE = "+916006617842";
let originalCwd: string;
let tmp: string;

beforeEach(async () => {
  // The fs backend writes to `${cwd}/data/otp-store.json` — point it at a tmp dir per test.
  originalCwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), "otp-store-"));
  process.chdir(tmp);
  delete process.env.NETLIFY;
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tmp, { recursive: true, force: true });
});

describe("generateCode", () => {
  it("returns a numeric string of CODE_LENGTH digits", () => {
    for (let i = 0; i < 25; i++) {
      const c = generateCode();
      expect(c).toHaveLength(CODE_LENGTH);
      expect(c).toMatch(/^\d+$/);
    }
  });
});

describe("issueOtp", () => {
  it("issues a fresh code for a new phone", async () => {
    const out = await issueOtp({ phone: PHONE, channel: "whatsapp" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.code).toMatch(/^\d{6}$/);
      expect(out.result.expiresAt).toBeGreaterThan(Date.now());
    }
  });

  it("rejects a re-issue inside the cooldown window", async () => {
    const now = Date.now();
    await issueOtp({ phone: PHONE, channel: "whatsapp", now });
    const second = await issueOtp({ phone: PHONE, channel: "whatsapp", now: now + 1000 });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("cooldown");
      expect(second.retryAfterMs).toBeGreaterThan(0);
      expect(second.retryAfterMs).toBeLessThanOrEqual(RESEND_COOLDOWN_MS);
    }
  });

  it("allows a re-issue after the cooldown window", async () => {
    const now = Date.now();
    await issueOtp({ phone: PHONE, channel: "whatsapp", now });
    const second = await issueOtp({
      phone: PHONE,
      channel: "whatsapp",
      now: now + RESEND_COOLDOWN_MS + 1,
    });
    expect(second.ok).toBe(true);
  });
});

describe("verifyOtp", () => {
  it("returns not_found when no code was issued", async () => {
    const r = await verifyOtp({ phone: PHONE, code: "123456" });
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });

  it("accepts the correct code and consumes it (single use)", async () => {
    const issued = await issueOtp({ phone: PHONE, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");
    const ok = await verifyOtp({ phone: PHONE, code: issued.result.code });
    expect(ok).toEqual({ ok: true });
    const again = await verifyOtp({ phone: PHONE, code: issued.result.code });
    expect(again).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a wrong code and decrements attemptsRemaining", async () => {
    const issued = await issueOtp({ phone: PHONE, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");
    const wrong = await verifyOtp({ phone: PHONE, code: "000000" });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.reason).toBe("wrong_code");
      expect(wrong.attemptsRemaining).toBe(MAX_ATTEMPTS - 1);
    }
  });

  it("invalidates the OTP after MAX_ATTEMPTS wrong codes", async () => {
    const issued = await issueOtp({ phone: PHONE, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");
    let last;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      last = await verifyOtp({ phone: PHONE, code: "000000" });
    }
    expect(last).toEqual({ ok: false, reason: "too_many_attempts" });
    const afterLock = await verifyOtp({ phone: PHONE, code: issued.result.code });
    expect(afterLock).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns expired and clears the record once the TTL has passed", async () => {
    const t0 = Date.now();
    const issued = await issueOtp({ phone: PHONE, channel: "whatsapp", now: t0 });
    if (!issued.ok) throw new Error("setup failed");
    const expired = await verifyOtp({ phone: PHONE, code: issued.result.code, now: t0 + TTL_MS + 1 });
    expect(expired).toEqual({ ok: false, reason: "expired" });
    const after = await verifyOtp({ phone: PHONE, code: issued.result.code, now: t0 + TTL_MS + 2 });
    expect(after).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("clearOtp", () => {
  it("removes a stored record", async () => {
    const issued = await issueOtp({ phone: PHONE, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");
    await clearOtp(PHONE);
    const r = await verifyOtp({ phone: PHONE, code: issued.result.code });
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});
