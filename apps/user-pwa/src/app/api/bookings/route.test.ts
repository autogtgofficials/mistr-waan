import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  createBooking: vi.fn(),
  listBookingsForProfile: vi.fn(),
  resolveGarageId: vi.fn(async () => null),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppTemplate: vi.fn(async () => ({ messageId: "wamid.MOCK", provider: "meta" })),
}));
vi.mock("@/lib/rate-limit/store", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 99, resetAt: Date.now() + 60_000 })),
}));

import { POST, GET } from "./route";
import { getCustomerSession } from "@/lib/auth/session";
import { createBooking, listBookingsForProfile, resolveGarageId } from "@/lib/bookings/data";
import { appendAuditEntry } from "@/lib/audit/log";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";

const sessionMock = vi.mocked(getCustomerSession);
const createMock = vi.mocked(createBooking);
const listMock = vi.mocked(listBookingsForProfile);
const resolveMock = vi.mocked(resolveGarageId);
const auditMock = vi.mocked(appendAuditEntry);
const sendMock = vi.mocked(sendWhatsAppTemplate);

const sampleBooking = {
  id: "b-uuid",
  shortId: "MW-AB23CD",
  profileId: "p-1",
  bucket: "detailing" as const,
  serviceIds: ["foam-wash"],
  garageId: null,
  slotDate: null,
  slotTime: null,
  slotLabel: "Tomorrow 10 AM",
  paymentMode: "cash" as const,
  total: 500,
  baseTotal: 500,
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
  createMock.mockReset();
  listMock.mockReset();
  resolveMock.mockReset();
  resolveMock.mockResolvedValue(null);
  auditMock.mockReset();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ messageId: "wamid.MOCK", provider: "meta" });
});

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings", () => {
  it("401s without a session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("400s on invalid bucket", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    const res = await POST(postReq({ bucket: "explosion", serviceIds: [], slotLabel: "x", paymentMode: "cash" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_bucket");
  });

  it("400s on non-array serviceIds", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    const res = await POST(postReq({ bucket: "detailing", serviceIds: "foam-wash", slotLabel: "x", paymentMode: "cash" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_service_ids");
  });

  it("400s on missing slot label", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    const res = await POST(postReq({ bucket: "detailing", serviceIds: [], paymentMode: "cash" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_slot_label");
  });

  it("400s on invalid payment mode", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    const res = await POST(
      postReq({ bucket: "detailing", serviceIds: [], slotLabel: "x", paymentMode: "bitcoin" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payment_mode");
  });

  it("creates booking, audits success, sends WhatsApp template", async () => {
    sessionMock.mockResolvedValueOnce({
      sub: "p-1",
      role: "customer",
      phone: "+916006617842",
    });
    createMock.mockResolvedValueOnce(sampleBooking);

    const res = await POST(
      postReq({
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        slotLabel: "Tomorrow 10 AM",
        paymentMode: "cash",
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { booking: { id: string } };
    expect(body.booking.id).toBe("b-uuid");

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "p-1",
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        slotLabel: "Tomorrow 10 AM",
        paymentMode: "cash",
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create_booking", outcome: "success" }),
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+916006617842",
        template: "booking_confirmed",
      }),
    );
  });

  it("resolves garageId slug to UUID before creating booking", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    resolveMock.mockResolvedValueOnce("garage-uuid-9999");
    createMock.mockResolvedValueOnce(sampleBooking);

    await POST(
      postReq({
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        garageId: "g-imran-k",
        slotLabel: "Tomorrow 10 AM",
        paymentMode: "cash",
      }),
    );
    expect(resolveMock).toHaveBeenCalledWith("g-imran-k");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ garageId: "garage-uuid-9999" }),
    );
  });

  it("creates booking with null garageId when slug is unknown (ops will assign)", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    resolveMock.mockResolvedValueOnce(null);
    createMock.mockResolvedValueOnce(sampleBooking);

    await POST(
      postReq({
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        garageId: "g-doesnt-exist",
        slotLabel: "x",
        paymentMode: "cash",
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ garageId: null }),
    );
  });

  it("500s and audits error when createBooking throws", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    createMock.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(
      postReq({
        bucket: "detailing",
        serviceIds: [],
        slotLabel: "x",
        paymentMode: "cash",
      }),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("create_failed");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create_booking", outcome: "error" }),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does NOT fail the booking when WhatsApp send fails", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    createMock.mockResolvedValueOnce(sampleBooking);
    sendMock.mockRejectedValueOnce(new Error("template not approved"));

    const res = await POST(
      postReq({
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        slotLabel: "x",
        paymentMode: "cash",
      }),
    );
    expect(res.status).toBe(201);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "booking_confirmed_send_failed", outcome: "error" }),
    );
  });
});

describe("GET /api/bookings", () => {
  it("401s without session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns bookings for current profile", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91..." });
    listMock.mockResolvedValueOnce([sampleBooking]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bookings: { id: string }[] };
    expect(body.bookings).toHaveLength(1);
    expect(listMock).toHaveBeenCalledWith("p-1");
  });
});
