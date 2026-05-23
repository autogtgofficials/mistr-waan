import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/quote", () => ({
  setQuote: vi.fn(),
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
          maybeSingle: () => Promise.resolve({ data: { phone: "+916006617842" } }),
        }),
      }),
    }),
  }),
}));

import { PATCH } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { setQuote } from "@/lib/bookings/quote";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";

const sessionMock = vi.mocked(getOpsSession);
const getMock = vi.mocked(getBookingById);
const setMock = vi.mocked(setQuote);
const notifyMock = vi.mocked(notifyTemplate);
const auditMock = vi.mocked(appendAuditEntry);

const before = {
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
};

beforeEach(() => {
  sessionMock.mockReset();
  getMock.mockReset();
  setMock.mockReset();
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
  auditMock.mockReset();
});

function patchReq(body: unknown): Request {
  return new Request("http://x/api/ops/bookings/b-1/quote", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "b-1" }) };

describe("PATCH /api/ops/bookings/[id]/quote", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ amount: 500 }), ctx);
    expect(res.status).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("400s on invalid amount", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    const res = await PATCH(patchReq({ amount: "lol" }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_amount");
  });

  it("400s on negative amount", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    const res = await PATCH(patchReq({ amount: -1 }), ctx);
    expect(res.status).toBe(400);
  });

  it("404s when booking does not exist", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "o@x" });
    getMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ amount: 500 }), ctx);
    expect(res.status).toBe(404);
  });

  it("sets quote, audits success, fires booking_quoted WA", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "ops@x" });
    getMock.mockResolvedValueOnce(before);
    setMock.mockResolvedValueOnce({ ...before, total: 3200, status: "quoted" });

    const res = await PATCH(patchReq({ amount: 3200, note: "via call" }), ctx);
    expect(res.status).toBe(200);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b-1", amount: 3200, note: "via call" }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+916006617842",
        template: "booking_quoted",
        variables: ["MW-AB23CD", "₹3200", "Cash on visit"],
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "set_quote", outcome: "success" }),
    );
  });

  it("audits error when setQuote throws", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "ops", role: "ops", email: "ops@x" });
    getMock.mockResolvedValueOnce(before);
    setMock.mockRejectedValueOnce(new Error("cannot quote a completed booking"));

    const res = await PATCH(patchReq({ amount: 3200 }), ctx);
    expect(res.status).toBe(400);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "set_quote", outcome: "error" }),
    );
  });
});
