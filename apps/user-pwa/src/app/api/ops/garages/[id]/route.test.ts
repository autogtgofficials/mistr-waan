import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getOpsSession: vi.fn() }));
vi.mock("@/lib/garage/data", () => ({
  getGarageById: vi.fn(),
  setGarageOnboardingStatus: vi.fn(async () => undefined),
}));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o", messageId: "m" })),
}));
vi.mock("@/lib/audit/log", () => ({ appendAuditEntry: vi.fn() }));

import { PATCH } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { getGarageById, setGarageOnboardingStatus } from "@/lib/garage/data";
import { notifyTemplate } from "@/lib/notifications/outbox";

const sessionMock = vi.mocked(getOpsSession);
const getMock = vi.mocked(getGarageById);
const setMock = vi.mocked(setGarageOnboardingStatus);
const notifyMock = vi.mocked(notifyTemplate);

const garage = {
  id: "g-1",
  slug: null,
  shopName: "Khan Auto",
  ownerFirstName: "Imran",
  ownerLastName: "Khan",
  area: "Rajbagh",
  fullAddress: "Rajbagh",
  phone: "+919999988888",
  whatsappPhone: "+919999988888",
  rating: 0,
  jobsCompleted: 0,
  commissionPct: 12,
  serviceBuckets: ["detailing"],
  active: false,
  onboardingStatus: "pending_verification" as const,
  workingHours: "9-8",
  weeklyOff: "Friday",
  rsaAvailable: true,
  rsaRadiusKm: 10,
  pickupAvailable: false,
  verificationDocPath: "pending/abc.jpg",
};

beforeEach(() => {
  sessionMock.mockReset();
  getMock.mockReset();
  setMock.mockReset();
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ outboxId: "o", messageId: "m" });
});

const ctx = { params: Promise.resolve({ id: "g-1" }) };

function patchReq(body: unknown): Request {
  return new Request("http://x/api/ops/garages/g-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/ops/garages/[id]", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ active: true }), ctx);
    expect(res.status).toBe(401);
  });

  it("400s when nothing to update", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    const res = await PATCH(patchReq({}), ctx);
    expect(res.status).toBe(400);
  });

  it("404s when garage missing", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ onboarding_status: "active", active: true }), ctx);
    expect(res.status).toBe(404);
  });

  it("activates + fires mechanic_activated WA", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(garage);
    const res = await PATCH(
      patchReq({ onboarding_status: "active", active: true }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ garageId: "g-1", status: "active", active: true }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "mechanic_activated" }),
    );
  });

  it("rejects + fires mechanic_rejected WA with reason", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(garage);
    const res = await PATCH(
      patchReq({
        onboarding_status: "rejected",
        active: false,
        rejected_reason: "Doc unclear",
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "mechanic_rejected",
        variables: ["Imran", "Doc unclear"],
      }),
    );
  });
});
