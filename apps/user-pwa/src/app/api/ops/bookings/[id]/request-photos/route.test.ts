import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getOpsSession: vi.fn() }));
vi.mock("@/lib/bookings/data", () => ({ getBookingById: vi.fn() }));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o", messageId: "m" })),
}));
vi.mock("@/lib/whatsapp/bot/photo-requests", () => ({
  setPhotoRequest: vi.fn(async () => ({})),
}));
vi.mock("@/lib/audit/log", () => ({ appendAuditEntry: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { phone: "+916006617842", first_name: "Aaliyah" },
            }),
        }),
      }),
    }),
  }),
}));

import { POST } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { setPhotoRequest } from "@/lib/whatsapp/bot/photo-requests";

const sessionMock = vi.mocked(getOpsSession);
const getMock = vi.mocked(getBookingById);
const notifyMock = vi.mocked(notifyTemplate);
const setReqMock = vi.mocked(setPhotoRequest);

const booking = {
  id: "b-1",
  shortId: "MW-AB23CD",
  profileId: "p-1",
  bucket: "denting" as const,
  serviceIds: [],
  garageId: null,
  slotDate: null,
  slotTime: null,
  slotLabel: "x",
  paymentMode: "cash" as const,
  total: null,
  baseTotal: null,
  status: "queued_for_call" as const,
  symptoms: null,
  denting: null,
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
  vehicleType: null,
  vehicleBrand: null,
  vehicleModel: null,
  vehicleRegistration: null,
};

beforeEach(() => {
  sessionMock.mockReset();
  getMock.mockReset();
  notifyMock.mockReset();
  setReqMock.mockReset();
  notifyMock.mockResolvedValue({ outboxId: "o", messageId: "m" });
  setReqMock.mockResolvedValue({
    phone: "+916006617842",
    bookingId: "b-1",
    bookingShortId: "MW-AB23CD",
    maxPhotos: 8,
    photosSoFar: 0,
    createdAt: Date.now(),
  });
});

const ctx = { params: Promise.resolve({ id: "b-1" }) };

describe("POST /api/ops/bookings/[id]/request-photos", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://x", { method: "POST" }), ctx);
    expect(res.status).toBe(401);
  });

  it("404s when booking missing", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://x", { method: "POST" }), ctx);
    expect(res.status).toBe(404);
  });

  it("sets a PhotoRequest + sends request_photos WA", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(booking);
    const res = await POST(new Request("http://x", { method: "POST" }), ctx);
    expect(res.status).toBe(200);
    expect(setReqMock).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+916006617842", bookingId: "b-1" }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "request_photos" }),
    );
  });
});
