import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(async () => undefined),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { setSessionCookie } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";

const cookieMock = vi.mocked(setSessionCookie);
const auditMock = vi.mocked(appendAuditEntry);

const ORIGINAL = process.env.OPS_SHARED_PASSWORD;

beforeEach(() => {
  process.env.OPS_SHARED_PASSWORD = "correct-horse-battery-staple";
  cookieMock.mockClear();
  auditMock.mockReset();
});

afterEach(() => {
  process.env.OPS_SHARED_PASSWORD = ORIGINAL;
});

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/ops/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ops/login", () => {
  it("500s when OPS_SHARED_PASSWORD is not configured", async () => {
    delete process.env.OPS_SHARED_PASSWORD;
    const res = await POST(postReq({ password: "anything" }));
    expect(res.status).toBe(500);
  });

  it("401s on wrong password and audits the failure", async () => {
    const res = await POST(postReq({ password: "wrong" }));
    expect(res.status).toBe(401);
    expect(cookieMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ops_login", outcome: "error", error: "bad_password" }),
    );
  });

  it("401s on missing password body", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it("200s on correct password, sets ops cookie, audits success", async () => {
    const res = await POST(postReq({ password: "correct-horse-battery-staple" }));
    expect(res.status).toBe(200);
    expect(cookieMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ops", sub: "shared-ops" }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ops_login", outcome: "success" }),
    );
  });

  it("rejects passwords of different length without leaking timing", async () => {
    const res = await POST(postReq({ password: "x" }));
    expect(res.status).toBe(401);
    expect(cookieMock).not.toHaveBeenCalled();
  });
});
