import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/notes", () => ({
  addBookingNote: vi.fn(),
  listBookingNotes: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { POST, GET } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { addBookingNote, listBookingNotes } from "@/lib/bookings/notes";

const sessionMock = vi.mocked(getOpsSession);
const bookingMock = vi.mocked(getBookingById);
const addMock = vi.mocked(addBookingNote);
const listMock = vi.mocked(listBookingNotes);

beforeEach(() => {
  sessionMock.mockReset();
  bookingMock.mockReset();
  addMock.mockReset();
  listMock.mockReset();
});

const ctx = { params: Promise.resolve({ id: "b-1" }) };

function postReq(body: unknown): Request {
  return new Request("http://x/api/ops/bookings/b-1/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ops/bookings/[id]/notes", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(postReq({ body: "hi" }), ctx);
    expect(res.status).toBe(401);
  });

  it("404s when booking missing", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "o", role: "ops", email: "o@x" });
    bookingMock.mockResolvedValueOnce(null);
    const res = await POST(postReq({ body: "hi" }), ctx);
    expect(res.status).toBe(404);
  });

  it("400s on empty body", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "o", role: "ops", email: "o@x" });
    bookingMock.mockResolvedValueOnce({ id: "b-1" } as never);
    const res = await POST(postReq({ body: "   " }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });

  it("creates note + returns 201", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "o", role: "ops", email: "o@x" });
    bookingMock.mockResolvedValueOnce({ id: "b-1" } as never);
    addMock.mockResolvedValueOnce({
      id: "n-1",
      bookingId: "b-1",
      author: "o@x",
      body: "called",
      createdAt: new Date().toISOString(),
    });
    const res = await POST(postReq({ body: "called" }), ctx);
    expect(res.status).toBe(201);
    expect(addMock).toHaveBeenCalledWith({
      bookingId: "b-1",
      author: "o@x",
      body: "called",
    });
  });
});

describe("GET /api/ops/bookings/[id]/notes", () => {
  it("401s without ops session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns notes for ops session", async () => {
    sessionMock.mockResolvedValueOnce({ sub: "o", role: "ops", email: "o@x" });
    listMock.mockResolvedValueOnce([]);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
  });
});
