import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
}));
vi.mock("@/lib/auth/profile", () => ({
  getProfileById: vi.fn(),
}));

import { GET } from "./route";
import { getCustomerSession } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";

const sessionMock = vi.mocked(getCustomerSession);
const profileMock = vi.mocked(getProfileById);

beforeEach(() => {
  sessionMock.mockReset();
  profileMock.mockReset();
});

describe("GET /api/auth/me", () => {
  it("401s when there is no session cookie", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("404s when the session is valid but profile no longer exists", async () => {
    sessionMock.mockResolvedValueOnce({
      sub: "missing-id",
      role: "customer",
      phone: "+91...",
    });
    profileMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns the profile when authenticated", async () => {
    sessionMock.mockResolvedValueOnce({
      sub: "p-1",
      role: "customer",
      phone: "+916006617842",
    });
    profileMock.mockResolvedValueOnce({
      id: "p-1",
      phone: "+916006617842",
      firstName: "User",
      language: "en",
      referralCode: null,
      referredBy: null,
      loyaltyPoints: 0,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: { id: string } };
    expect(body.profile.id).toBe("p-1");
  });

  it("404s if profile lookup throws", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    profileMock.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
