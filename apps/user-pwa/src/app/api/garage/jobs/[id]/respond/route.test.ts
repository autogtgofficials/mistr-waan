import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getGarageSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/assign", () => ({
  respondToAssignment: vi.fn(),
}));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o-1", messageId: "wamid.x" })),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            table === "garages"
              ? Promise.resolve({ data: { shop_name: "Imran's Auto" } })
              : Promise.resolve({
                  data: { phone: "+916006617842", first_name: "Aaliyah" },
                }),
        }),
      }),
    }),
  }),
}));

import { POST } from "./route";
import { getGarageSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { respondToAssignment } from "@/lib/bookings/assign";
import { notifyTemplate } from "@/lib/notifications/outbox";

const sessionMock = vi.mocked(getGarageSession);
const getMock = vi.mocked(getBookingById);
const respondMock = vi.mocked(respondToAssignment);
const notifyMock = vi.mocked(notifyTemplate);

const sample = {
  id: "b-1",
  shortId: "MW-AB23CD",
  profileId: "p-1",
  bucket: "detailing" as const,
  serviceIds: [],
  garageId: "g-1",
  slotDate: null,
  slotTime: null,
  slotLabel: "x",
  paymentMode: "cash" as const,
  total: 500,
  baseTotal: 500,
  status: "awaiting_garage" as const,
  symptoms: null,
  denting: null,
  cancellationReason: null,
  ratingValue: null,
  ratingComment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  queuedForCallAt: new Date().toISOString(),
  quotedAt: new Date().toISOString(),
  assignedAt: new Date().toISOString(),
  inProgressAt: null,
  completedAt: null,
  cancelledAt: null,
};

beforeEach(() => {
  sessionMock.mockReset();
  getMock.mockReset();
  respondMock.mockReset();
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
});

function postReq(body: unknown): Request {
  return new Request("http://x/api/garage/jobs/b-1/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://garage.autogtg.com" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "b-1" }) };

describe("POST /api/garage/jobs/[id]/respond", () => {
  it("401s without garage session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(postReq({ outcome: "accept" }), ctx);
    expect(res.status).toBe(401);
  });

  it("400s on invalid outcome", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "g-1", role: "garage", phone: "+91x" });
    const res = await POST(postReq({ outcome: "maybe" }), ctx);
    expect(res.status).toBe(400);
  });

  it("403s when garage is not assigned to this booking", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "g-2", role: "garage", phone: "+91x" });
    getMock.mockResolvedValueOnce(sample);
    const res = await POST(postReq({ outcome: "accept" }), ctx);
    expect(res.status).toBe(403);
  });

  it("accept transitions + notifies customer", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "g-1", role: "garage", phone: "+91x" });
    getMock.mockResolvedValueOnce(sample);
    respondMock.mockResolvedValueOnce({ ...sample, status: "assigned" });

    const res = await POST(postReq({ outcome: "accept" }), ctx);
    expect(res.status).toBe(200);
    expect(respondMock).toHaveBeenCalledWith({
      bookingId: "b-1",
      garageId: "g-1",
      outcome: "accept",
    });
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "mechanic_assigned" }),
    );
  });

  it("decline sends garage_declined to customer", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "g-1", role: "garage", phone: "+91x" });
    getMock.mockResolvedValueOnce(sample);
    respondMock.mockResolvedValueOnce({ ...sample, status: "declined_by_garage" });

    const res = await POST(postReq({ outcome: "decline" }), ctx);
    expect(res.status).toBe(200);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "garage_declined" }),
    );
  });
});
