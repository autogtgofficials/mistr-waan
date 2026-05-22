import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(async () => undefined),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/ops/users", () => ({
  ensureBootstrapAdmin: vi.fn(),
  findOpsUserByEmail: vi.fn(),
  touchOpsLogin: vi.fn(),
}));

import { POST } from "./route";
import { setSessionCookie } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";
import {
  ensureBootstrapAdmin,
  findOpsUserByEmail,
  touchOpsLogin,
} from "@/lib/ops/users";

const cookieMock = vi.mocked(setSessionCookie);
const auditMock = vi.mocked(appendAuditEntry);
const findMock = vi.mocked(findOpsUserByEmail);
const bootMock = vi.mocked(ensureBootstrapAdmin);
const touchMock = vi.mocked(touchOpsLogin);

const ORIGINAL = process.env.OPS_SHARED_PASSWORD;

beforeEach(() => {
  process.env.OPS_SHARED_PASSWORD = "correct-horse-battery-staple";
  cookieMock.mockClear();
  auditMock.mockReset();
  findMock.mockReset();
  bootMock.mockReset();
  touchMock.mockReset();
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

const activeUser = {
  id: "ops-1",
  email: "ops@autogtg.com",
  role: "ops" as const,
  active: true,
  inviteToken: null,
  invitedBy: null,
  inviteAcceptedAt: new Date().toISOString(),
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
};

describe("POST /api/ops/login", () => {
  it("500s when OPS_SHARED_PASSWORD is not configured", async () => {
    delete process.env.OPS_SHARED_PASSWORD;
    const res = await POST(postReq({ email: "ops@autogtg.com", password: "anything" }));
    expect(res.status).toBe(500);
  });

  it("400s on missing email", async () => {
    const res = await POST(postReq({ password: "anything" }));
    expect(res.status).toBe(400);
  });

  it("400s on invalid email", async () => {
    const res = await POST(postReq({ email: "nope", password: "anything" }));
    expect(res.status).toBe(400);
  });

  it("401s on wrong password and audits the failure", async () => {
    findMock.mockResolvedValueOnce(activeUser);
    const res = await POST(postReq({ email: "ops@autogtg.com", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(cookieMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ops_login", outcome: "error", error: "bad_password" }),
    );
  });

  it("200s on correct credentials for an active seat", async () => {
    findMock.mockResolvedValueOnce(activeUser);
    const res = await POST(
      postReq({ email: "ops@autogtg.com", password: "correct-horse-battery-staple" }),
    );
    expect(res.status).toBe(200);
    expect(cookieMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ops", sub: "ops-1", email: "ops@autogtg.com" }),
    );
    expect(touchMock).toHaveBeenCalledWith("ops-1");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ops_login", outcome: "success" }),
    );
  });

  it("bootstraps the first admin when ops_users is empty", async () => {
    findMock.mockResolvedValueOnce(null);
    bootMock.mockResolvedValueOnce(activeUser);
    const res = await POST(
      postReq({ email: "ops@autogtg.com", password: "correct-horse-battery-staple" }),
    );
    expect(res.status).toBe(200);
    expect(bootMock).toHaveBeenCalledWith("ops@autogtg.com");
  });

  it("403s when invite required and no bootstrap available", async () => {
    findMock.mockResolvedValueOnce(null);
    bootMock.mockRejectedValueOnce(new Error("invite_required"));
    const res = await POST(
      postReq({ email: "newcomer@autogtg.com", password: "correct-horse-battery-staple" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("invite_required");
  });

  it("403s when seat exists but is pending invite acceptance", async () => {
    findMock.mockResolvedValueOnce({ ...activeUser, active: false });
    const res = await POST(
      postReq({ email: "ops@autogtg.com", password: "correct-horse-battery-staple" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("invite_pending");
  });
});
