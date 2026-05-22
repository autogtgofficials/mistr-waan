import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
  getBookingByShortId: vi.fn(),
}));

import { GET } from "./route";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById, getBookingByShortId } from "@/lib/bookings/data";

const customerMock = vi.mocked(getCustomerSession);
const opsMock = vi.mocked(getOpsSession);
const bookingMock = vi.mocked(getBookingById);
const shortIdMock = vi.mocked(getBookingByShortId);

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_SHORT = "MW-AB23CD";

const sampleBooking = {
  id: "b-1",
  shortId: "MW-AB23CD",
  profileId: "owner-uuid",
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
};

beforeEach(() => {
  customerMock.mockReset();
  opsMock.mockReset();
  bookingMock.mockReset();
  shortIdMock.mockReset();
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/bookings/[id]", () => {
  it("401s with no session at all", async () => {
    customerMock.mockResolvedValueOnce(null);
    opsMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"), ctx(VALID_UUID));
    expect(res.status).toBe(401);
  });

  it("400s when id is neither a UUID nor a short_id", async () => {
    customerMock.mockResolvedValueOnce({ sub: "owner-uuid", role: "customer", phone: "+91..." });
    opsMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"), ctx("garbage"));
    expect(res.status).toBe(400);
  });

  it("404s when booking does not exist (UUID lookup)", async () => {
    customerMock.mockResolvedValueOnce({ sub: "owner-uuid", role: "customer", phone: "+91..." });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"), ctx(VALID_UUID));
    expect(res.status).toBe(404);
    expect(bookingMock).toHaveBeenCalledWith(VALID_UUID);
    expect(shortIdMock).not.toHaveBeenCalled();
  });

  it("404s when booking does not exist (short_id lookup)", async () => {
    customerMock.mockResolvedValueOnce({ sub: "owner-uuid", role: "customer", phone: "+91..." });
    opsMock.mockResolvedValueOnce(null);
    shortIdMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"), ctx(VALID_SHORT));
    expect(res.status).toBe(404);
    expect(shortIdMock).toHaveBeenCalledWith(VALID_SHORT);
    expect(bookingMock).not.toHaveBeenCalled();
  });

  it("403s when customer tries to view someone else's booking", async () => {
    customerMock.mockResolvedValueOnce({ sub: "stranger", role: "customer", phone: "+91..." });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(sampleBooking);
    const res = await GET(new Request("http://x"), ctx(VALID_UUID));
    expect(res.status).toBe(403);
  });

  it("returns booking to its owner via UUID", async () => {
    customerMock.mockResolvedValueOnce({ sub: "owner-uuid", role: "customer", phone: "+91..." });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(sampleBooking);
    const res = await GET(new Request("http://x"), ctx(VALID_UUID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { id: string } };
    expect(body.booking.id).toBe("b-1");
  });

  it("returns booking to its owner via short_id", async () => {
    customerMock.mockResolvedValueOnce({ sub: "owner-uuid", role: "customer", phone: "+91..." });
    opsMock.mockResolvedValueOnce(null);
    shortIdMock.mockResolvedValueOnce(sampleBooking);
    const res = await GET(new Request("http://x"), ctx(VALID_SHORT));
    expect(res.status).toBe(200);
  });

  it("returns booking to ops even if owned by someone else", async () => {
    customerMock.mockResolvedValueOnce(null);
    opsMock.mockResolvedValueOnce({ sub: "ops-uuid", role: "ops", email: "o@x" });
    bookingMock.mockResolvedValueOnce(sampleBooking);
    const res = await GET(new Request("http://x"), ctx(VALID_UUID));
    expect(res.status).toBe(200);
  });
});
