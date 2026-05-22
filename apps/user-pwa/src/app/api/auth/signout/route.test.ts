import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
  clearSessionCookie: vi.fn(async () => undefined),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { getCustomerSession, clearSessionCookie } from "@/lib/auth/session";
import { appendAuditEntry } from "@/lib/audit/log";

const sessionMock = vi.mocked(getCustomerSession);
const clearMock = vi.mocked(clearSessionCookie);
const auditMock = vi.mocked(appendAuditEntry);

beforeEach(() => {
  sessionMock.mockReset();
  clearMock.mockClear();
  auditMock.mockReset();
});

describe("POST /api/auth/signout", () => {
  it("clears the cookie and audits when there is a session", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signedOut: true });
    expect(clearMock).toHaveBeenCalledWith("customer");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "signout", entityId: "p-1" }),
    );
  });

  it("is idempotent — returns 200 with no audit when no session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(clearMock).toHaveBeenCalledWith("customer");
    expect(auditMock).not.toHaveBeenCalled();
  });
});
