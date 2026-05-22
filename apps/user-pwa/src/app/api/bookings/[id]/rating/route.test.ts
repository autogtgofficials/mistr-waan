import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
  getBookingByShortId: vi.fn(),
}));
vi.mock("@/lib/bookings/ratings", () => ({
  addBookingRating: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST } from "./route";
import { getCustomerSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { addBookingRating } from "@/lib/bookings/ratings";

const sessionMock = vi.mocked(getCustomerSession);
const getMock = vi.mocked(getBookingById);
const addMock = vi.mocked(addBookingRating);

const completed = {
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
  status: "completed" as const,
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
  inProgressAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  cancelledAt: null,
};

beforeEach(() => {
  sessionMock.mockReset();
  getMock.mockReset();
  addMock.mockReset();
});

const ctx = { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }) };

function req(body: unknown): Request {
  return new Request("http://x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings/[id]/rating", () => {
  it("401s without session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(req({ score: 5 }), ctx);
    expect(res.status).toBe(401);
  });

  it("400s on invalid score", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    getMock.mockResolvedValueOnce(completed);
    const res = await POST(req({ score: 6 }), ctx);
    expect(res.status).toBe(400);
  });

  it("403s when rating someone else's booking", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-2", role: "customer", phone: "+91x" });
    getMock.mockResolvedValueOnce(completed);
    const res = await POST(req({ score: 5 }), ctx);
    expect(res.status).toBe(403);
  });

  it("calls addBookingRating + audits on success", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    getMock.mockResolvedValueOnce(completed);
    addMock.mockResolvedValueOnce({ ...completed, ratingValue: 5 });
    const res = await POST(req({ score: 5, comment: "great" }), ctx);
    expect(res.status).toBe(200);
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({ score: 5, comment: "great", profileId: "p-1" }),
    );
  });

  it("409 on already_rated", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    getMock.mockResolvedValueOnce(completed);
    addMock.mockRejectedValueOnce(new Error("already_rated"));
    const res = await POST(req({ score: 5 }), ctx);
    expect(res.status).toBe(409);
  });
});
