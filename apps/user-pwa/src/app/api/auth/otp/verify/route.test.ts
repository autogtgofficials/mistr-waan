import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { issueOtp, clearOtp } from "@/lib/otp/store";
import { appendAuditEntry } from "@/lib/audit/log";

const auditMock = vi.mocked(appendAuditEntry);

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

  it("verifies a correct OTP, audits success, and returns the canonical phone", async () => {
    const issued = await issueOtp({ phone: PHONE_E164, channel: "whatsapp" });
    if (!issued.ok) throw new Error("setup failed");

    const res = await POST(postReq({ phone: PHONE_NATIONAL, code: issued.result.code }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean; phone: string };
    expect(body).toEqual({ verified: true, phone: PHONE_E164 });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "verify_otp", outcome: "success" }),
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
