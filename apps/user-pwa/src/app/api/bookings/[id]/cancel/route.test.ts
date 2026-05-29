import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
  getBookingByShortId: vi.fn(),
}));
vi.mock("@/lib/bookings/lifecycle", () => ({
  cancelJob: vi.fn(),
}));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o-1", messageId: "wamid.x" })),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { phone: "+916006617842", first_name: "Aaliyah" } }),
        }),
      }),
    }),
  }),
}));

import { PATCH } from "./route";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { cancelJob } from "@/lib/bookings/lifecycle";
import { notifyTemplate } from "@/lib/notifications/outbox";

const customerMock = vi.mocked(getCustomerSession);
const opsMock = vi.mocked(getOpsSession);
const getMock = vi.mocked(getBookingById);
const cancelMock = vi.mocked(cancelJob);
const notifyMock = vi.mocked(notifyTemplate);

const sample = {
  id: "b-1",
  shortId: "MW-AB23CD",
  profileId: "p-1",
  bucket: "detailing" as const,
  serviceIds: [],
  garageId: null,
  slotDate: null,
  slotTime: null,
  slotLabel: "x",
  paymentMode: "cash" as const,
  total: 500,
  baseTotal: 500,
  status: "quoted" as const,
  symptoms: null,
  denting: null,
  cancellationReason: null,
  ratingValue: null,
  ratingComment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  queuedForCallAt: new Date().toISOString(),
  quotedAt: new Date().toISOString(),
  assignedAt: null,
  inProgressAt: null,
  completedAt: null,
  cancelledAt: null,
  vehicleType: null,
  vehicleBrand: null,
  vehicleModel: null,
  vehicleRegistration: null,
};

beforeEach(() => {
  customerMock.mockReset();
  opsMock.mockReset();
  getMock.mockReset();
  cancelMock.mockReset();
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
});

const ctx = { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }) };

function patchReq(body: unknown = {}): Request {
  return new Request("http://x/api/bookings/00000000-0000-0000-0000-000000000001/cancel", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/bookings/[id]/cancel", () => {
  it("401s without session", async () => {
    customerMock.mockResolvedValueOnce(null);
    opsMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq(), ctx);
    expect(res.status).toBe(401);
  });

  it("404s when booking missing", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    getMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq(), ctx);
    expect(res.status).toBe(404);
  });

  it("403s when customer cancels someone else's booking", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-2", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    getMock.mockResolvedValueOnce(sample);
    const res = await PATCH(patchReq(), ctx);
    expect(res.status).toBe(403);
  });

  it("cancels with cutoff enforced for customer + sends WA", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    getMock.mockResolvedValueOnce(sample);
    cancelMock.mockResolvedValueOnce({ ...sample, status: "cancelled" });

    const res = await PATCH(patchReq({ reason: "changed my mind" }), ctx);
    expect(res.status).toBe(200);
    expect(cancelMock).toHaveBeenCalledWith(
      expect.objectContaining({ enforceCutoff: true, reason: "changed my mind" }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "booking_cancelled" }),
    );
  });

  it("ops bypasses cutoff", async () => {
    customerMock.mockResolvedValueOnce(null);
    opsMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(sample);
    cancelMock.mockResolvedValueOnce({ ...sample, status: "cancelled" });
    const res = await PATCH(patchReq(), ctx);
    expect(res.status).toBe(200);
    expect(cancelMock).toHaveBeenCalledWith(
      expect.objectContaining({ enforceCutoff: false }),
    );
  });

  it("returns 409 when cutoff is exceeded", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    getMock.mockResolvedValueOnce(sample);
    cancelMock.mockRejectedValueOnce(new Error("cutoff_exceeded: less than 1 hour"));
    const res = await PATCH(patchReq(), ctx);
    expect(res.status).toBe(409);
  });
});
