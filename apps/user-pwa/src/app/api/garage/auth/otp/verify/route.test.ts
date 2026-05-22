import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/otp/store", () => ({
  verifyOtp: vi.fn(),
}));
vi.mock("@/lib/garage/data", () => ({
  findGarageByPhone: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { verifyOtp } from "@/lib/otp/store";
import { findGarageByPhone } from "@/lib/garage/data";
import { setSessionCookie } from "@/lib/auth/session";

const verifyMock = vi.mocked(verifyOtp);
const lookupMock = vi.mocked(findGarageByPhone);
const setCookieMock = vi.mocked(setSessionCookie);

const sampleGarage = {
  id: "g-1",
  slug: "g-imran-k",
  shopName: "Imran's Auto",
  ownerFirstName: "Imran",
  ownerLastName: "K",
  area: "Rajbagh",
  fullAddress: "Rajbagh, Srinagar",
  phone: "+919999999999",
  whatsappPhone: null,
  rating: 4.8,
  jobsCompleted: 12,
  commissionPct: 12,
  serviceBuckets: ["detailing"],
  active: true,
};

beforeEach(() => {
  verifyMock.mockReset();
  lookupMock.mockReset();
  setCookieMock.mockReset();
});

function req(body: unknown): Request {
  return new Request("http://x/api/garage/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/garage/auth/otp/verify", () => {
  it("400s on invalid input", async () => {
    const res = await POST(req({ phone: "abc", code: "xx" }));
    expect(res.status).toBe(400);
  });

  it("401s on wrong code", async () => {
    verifyMock.mockResolvedValueOnce({
      ok: false,
      reason: "wrong_code",
      attemptsRemaining: 2,
    });
    const res = await POST(req({ phone: "+916006617842", code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("404s when phone not registered as a garage", async () => {
    verifyMock.mockResolvedValueOnce({ ok: true });
    lookupMock.mockResolvedValueOnce(null);
    const res = await POST(req({ phone: "+916006617842", code: "123456" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("phone_not_registered");
  });

  it("sets cross-subdomain cookie + returns garage on success", async () => {
    verifyMock.mockResolvedValueOnce({ ok: true });
    lookupMock.mockResolvedValueOnce(sampleGarage);
    const res = await POST(req({ phone: "+916006617842", code: "123456" }));
    expect(res.status).toBe(200);
    expect(setCookieMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "garage",
        sub: "g-1",
        crossSubdomain: true,
      }),
    );
    const body = (await res.json()) as { garage: { shopName: string } };
    expect(body.garage.shopName).toBe("Imran's Auto");
  });
});
