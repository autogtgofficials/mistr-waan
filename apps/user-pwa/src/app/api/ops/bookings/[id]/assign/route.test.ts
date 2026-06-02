import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/assign", () => ({
  assignGarage: vi.fn(),
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
              ? Promise.resolve({
                  data: {
                    phone: "+919999999999",
                    whatsapp_phone: null,
                    shop_name: "Imran's Auto",
                    owner_first_name: "Imran",
                  },
                })
              : Promise.resolve({
                  data: { first_name: "Aaliyah", phone: "+916006617842" },
                }),
        }),
      }),
    }),
  }),
}));

import { PATCH } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { assignGarage } from "@/lib/bookings/assign";
import { notifyTemplate } from "@/lib/notifications/outbox";

const sessionMock = vi.mocked(getOpsSession);
const getMock = vi.mocked(getBookingById);
const assignMock = vi.mocked(assignGarage);
const notifyMock = vi.mocked(notifyTemplate);

const sample = {
  id: "b-1",
  shortId: "AG-AB23CD",
  profileId: "p-1",
  bucket: "detailing" as const,
  serviceIds: ["foam-wash"],
  services: [
    { id: "foam-wash", name: "Foam wash", basePrice: 500, durationLabel: "45m", blurb: null, isQuoted: false },
  ],
  garageId: "g-1",
  slotDate: null,
  slotTime: null,
  slotLabel: "Tomorrow 10 AM",
  paymentMode: "cash" as const,
  total: 3200,
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
  vehicleType: null,
  vehicleBrand: null,
  vehicleModel: null,
  vehicleRegistration: null,
};

beforeEach(() => {
  sessionMock.mockReset();
  getMock.mockReset();
  assignMock.mockReset();
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
});

function patchReq(body: unknown): Request {
  return new Request("http://x/api/ops/bookings/b-1/assign", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "b-1" }) };

describe("PATCH /api/ops/bookings/[id]/assign", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ garageId: "g-1" }), ctx);
    expect(res.status).toBe(401);
  });

  it("400s when garageId missing", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce({ ...sample, status: "quoted" as const, garageId: null });
    const res = await PATCH(patchReq({}), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("garage_id_required");
  });

  it("404s when booking missing", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ garageId: "g-1" }), ctx);
    expect(res.status).toBe(404);
  });

  it("assigns, then sends garage_new_job WA with Accept/Decline payloads", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "ops@x" });
    getMock.mockResolvedValueOnce({ ...sample, status: "quoted" as const, garageId: null });
    assignMock.mockResolvedValueOnce(sample);

    const res = await PATCH(patchReq({ garageId: "g-imran-k" }), ctx);
    expect(res.status).toBe(200);

    expect(assignMock).toHaveBeenCalledWith({
      bookingId: "b-1",
      garageIdOrSlug: "g-imran-k",
    });
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+919999999999",
        template: "garage_new_job",
        variables: ["Imran", "Aaliyah", "Foam wash", "Tomorrow 10 AM"],
        buttonPayloads: [
          { index: 0, payload: "booking:AG-AB23CD:accept" },
          { index: 1, payload: "booking:AG-AB23CD:decline" },
        ],
      }),
    );
  });
});
