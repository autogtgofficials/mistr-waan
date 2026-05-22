import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/ops-data", () => ({
  listOpsBookings: vi.fn(),
}));

import { GET } from "./route";
import { getOpsSession } from "@/lib/auth/session";
import { listOpsBookings } from "@/lib/bookings/ops-data";

const sessionMock = vi.mocked(getOpsSession);
const listMock = vi.mocked(listOpsBookings);

beforeEach(() => {
  sessionMock.mockReset();
  listMock.mockReset();
  listMock.mockResolvedValue([]);
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
