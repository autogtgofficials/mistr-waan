import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/ops-data", () => ({
  listOpsBookings: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  createBooking: vi.fn(),
}));
vi.mock("@/lib/auth/profile", () => ({
  upsertProfileByPhone: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }),
    }),
  }),
}));

import { GET, POST } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsBookings } from "@/lib/bookings/ops-data";
import { createBooking } from "@/lib/bookings/data";
import { upsertProfileByPhone } from "@/lib/auth/profile";

const sessionMock = vi.mocked(getOpsSession);
const listMock = vi.mocked(listOpsBookings);
const createMock = vi.mocked(createBooking);
const profileMock = vi.mocked(upsertProfileByPhone);

beforeEach(() => {
  sessionMock.mockReset();
  listMock.mockReset();
  listMock.mockResolvedValue([]);
  createMock.mockReset();
  profileMock.mockReset();
});

describe("GET /api/ops/bookings", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns 200 + bookings array for ops session", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "shared-ops", role: "ops", email: "o@x" });
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bookings: unknown[] };
    expect(Array.isArray(body.bookings)).toBe(true);
  });

  it("passes status filter through to the data layer", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "shared-ops", role: "ops", email: "o@x" });
    await GET(new Request("http://x?status=queued_for_call"));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued_for_call" }),
    );
  });

  it("rejects unknown status by leaving filter undefined", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "shared-ops", role: "ops", email: "o@x" });
    await GET(new Request("http://x?status=explosion"));
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("clamps limit to [1, 500]", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "shared-ops", role: "ops", email: "o@x" });
    await GET(new Request("http://x?limit=99999"));
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });

  it("passes bucket filter through to the data layer", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "shared-ops", role: "ops", email: "o@x" });
    await GET(new Request("http://x?bucket=detailing"));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "detailing" }),
    );
  });
});

const profile = {
  id: "p-1",
  phone: "+916006617842",
  firstName: null,
  language: null,
  referralCode: null,
  referredBy: null,
  loyaltyPoints: 0,
  createdAt: new Date().toISOString(),
  lastSeenAt: null,
};

function postReq(body: unknown): Request {
  return new Request("http://x/api/ops/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ops/bookings (create from call)", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(postReq({ phone: "+916006617842", bucket: "rsa", paymentMode: "cash" }));
    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("400s on invalid phone", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    const res = await POST(postReq({ phone: "123", bucket: "rsa", paymentMode: "cash" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_phone");
  });

  it("400s on invalid bucket", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    const res = await POST(
      postReq({ phone: "+916006617842", bucket: "explosion", paymentMode: "cash" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_bucket");
  });

  it("upserts profile by phone + creates booking + returns 201", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "ops@x" });
    profileMock.mockResolvedValueOnce(profile);
    createMock.mockResolvedValueOnce({
      id: "b-1",
      shortId: "MW-CALL01",
      profileId: "p-1",
      bucket: "scheduled_maintenance",
      serviceIds: ["car-oil-change"],
      garageId: null,
      slotDate: null,
      slotTime: null,
      slotLabel: "To be confirmed",
      paymentMode: "cash",
      total: 1500,
      baseTotal: 1500,
      status: "queued_for_call",
      symptoms: null,
      denting: null,
      vehicleType: "car",
      vehicleBrand: "Maruti",
      vehicleModel: "Swift",
      vehicleRegistration: null,
      cancellationReason: null,
      ratingValue: null,
      ratingComment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      queuedForCallAt: new Date().toISOString(),
      quotedAt: null,
      assignedAt: null,
      inProgressAt: null,
      completedAt: null,
      cancelledAt: null,
    });

    const res = await POST(
      postReq({
        phone: "+91 6006617842",
        firstName: "Aaliyah",
        bucket: "scheduled_maintenance",
        serviceIds: ["car-oil-change"],
        paymentMode: "cash",
        vehicleType: "car",
        vehicleBrand: "Maruti",
        vehicleModel: "Swift",
      }),
    );
    expect(res.status).toBe(201);
    expect(profileMock).toHaveBeenCalledWith("+916006617842");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "p-1",
        bucket: "scheduled_maintenance",
        serviceIds: ["car-oil-change"],
        vehicleType: "car",
        paymentMode: "cash",
      }),
    );
  });
});
