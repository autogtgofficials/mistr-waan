import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
}));
vi.mock("@/lib/referrals/data", () => ({
  claimReferral: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { getCustomerSession } from "@/lib/auth/session";
import { claimReferral } from "@/lib/referrals/data";

const sessionMock = vi.mocked(getCustomerSession);
const claimMock = vi.mocked(claimReferral);

beforeEach(() => {
  sessionMock.mockReset();
  claimMock.mockReset();
});

function req(body: unknown): Request {
  return new Request("http://x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/me/referral/claim", () => {
  it("401s without session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(req({ code: "ABCDE" }));
    expect(res.status).toBe(401);
  });

  it("400 on malformed code", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    const res = await POST(req({ code: "@@@" }));
    expect(res.status).toBe(400);
  });

  it("returns claimed=true on success", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    claimMock.mockResolvedValueOnce({ claimed: true });
    const res = await POST(req({ code: "ABC123" }));
    expect(res.status).toBe(200);
    expect((await res.json()).claimed).toBe(true);
  });

  it("idempotent — returns claimed=false with reason", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    claimMock.mockResolvedValueOnce({ claimed: false, reason: "already_referred" });
    const res = await POST(req({ code: "ABC123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claimed).toBe(false);
    expect(data.reason).toBe("already_referred");
  });
});
