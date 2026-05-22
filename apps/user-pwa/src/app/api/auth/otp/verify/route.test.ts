import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/auth/profile", () => ({
  upsertProfileByPhone: vi.fn(async (phone: string) => ({
    id: "test-profile-uuid",
    phone,
    firstName: "User",
    language: "en",
    referralCode: null,
    referredBy: null,
    loyaltyPoints: 0,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  })),
}));
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(async () => undefined),
}));

import { POST } from "./route";
import { issueOtp, clearOtp } from "@/lib/otp/store";
import { appendAuditEntry } from "@/lib/audit/log";
import { upsertProfileByPhone } from "@/lib/auth/profile";
import { setSessionCookie } from "@/lib/auth/session";

const auditMock = vi.mocked(appendAuditEntry);
const upsertMock = vi.mocked(upsertProfileByPhone);
const setCookieMock = vi.mocked(setSessionCookie);

const PHONE_NATIONAL = "6006617842";
const PHONE_E164 = "+916006617842";

let originalCwd: string;
let tmp: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), "otp-verify-"));
  process.chdir(tmp);
  delete process.env.NETLIFY;
  auditMock.mockReset();
  upsertMock.mockClear();
  setCookieMock.mockClear();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tmp, { recursive: true, force: true });
  await clearOtp(PHONE_E164).catch(() => undefined);
});

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/otp/verify", () => {
  it("400s on missing/invalid phone or code", async () => {
    const r1 = await POST(postReq({ phone: "bad", code: "123456" }));
    expect(r1.status).toBe(400);
    const r2 = await POST(postReq({ phone: PHONE_NATIONAL, code: "abc" }));
    expect(r2.status).toBe(400);
  });

  it("404s when no OTP is on file", async () => {
    const res = await POST(postReq({ phone: PHONE_NATIONAL, code: "123456" }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("verifies a correct OTP, upserts profile, sets cookie, and audits success", async () => {
    const issued = await issueOtp({ phone: PHONE_E164, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");

    const res = await POST(postReq({ phone: PHONE_NATIONAL, code: issued.result.code }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean; phone: string; profileId: string };
    expect(body).toEqual({ verified: true, phone: PHONE_E164, profileId: "test-profile-uuid" });

    expect(upsertMock).toHaveBeenCalledWith(PHONE_E164);
    expect(setCookieMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "customer", sub: "test-profile-uuid", phone: PHONE_E164 }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "verify_otp", outcome: "success" }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "signin", entityId: "test-profile-uuid" }),
    );
  });

  it("500s and audits when profile upsert fails", async () => {
    const issued = await issueOtp({ phone: PHONE_E164, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");
    upsertMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(postReq({ phone: PHONE_NATIONAL, code: issued.result.code }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("session_failed");
    expect(setCookieMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "verify_otp", outcome: "error" }),
    );
  });

  it("401s on a wrong code and surfaces attemptsRemaining", async () => {
    const issued = await issueOtp({ phone: PHONE_E164, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");
    const res = await POST(postReq({ phone: PHONE_NATIONAL, code: "000000" }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; attemptsRemaining: number };
    expect(body.error).toBe("wrong_code");
    expect(body.attemptsRemaining).toBe(4);
  });
});
