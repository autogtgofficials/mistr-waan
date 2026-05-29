import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("./data", () => ({
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/garage/data", () => ({
  incrementJobsCompleted: vi.fn(),
}));

import { startJob, completeJob, cancelJob } from "./lifecycle";
import { getBookingById } from "./data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { incrementJobsCompleted } from "@/lib/garage/data";

const getMock = vi.mocked(getBookingById);
const supabaseMock = vi.mocked(getSupabaseAdmin);
const incMock = vi.mocked(incrementJobsCompleted);

function buildSupabase(updateImpl: () => Promise<{ error: null | { message: string } }>) {
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn(() => updateImpl()),
  } as unknown as {
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: vi.fn(() => builder) } as any;
}

const base = {
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
  status: "assigned" as const,
  symptoms: null,
  denting: null,
  cancellationReason: null,
  ratingValue: null,
  ratingComment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  queuedForCallAt: new Date().toISOString(),
  quotedAt: null,
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
  getMock.mockReset();
  supabaseMock.mockReset();
  incMock.mockReset();
  supabaseMock.mockReturnValue(buildSupabase(async () => ({ error: null })));
});

describe("startJob", () => {
  it("transitions assigned -> in_progress", async () => {
    getMock
      .mockResolvedValueOnce(base) // pre-check
      .mockResolvedValueOnce({ ...base, status: "in_progress" }); // post-fetch
    const updated = await startJob("b-1");
    expect(updated.status).toBe("in_progress");
  });

  it("rejects non-assigned status", async () => {
    getMock.mockResolvedValueOnce({ ...base, status: "in_progress" });
    await expect(startJob("b-1")).rejects.toThrow(/cannot start/);
  });
});

describe("completeJob", () => {
  it("transitions in_progress -> completed + bumps jobs_completed", async () => {
    getMock
      .mockResolvedValueOnce({ ...base, status: "in_progress" })
      .mockResolvedValueOnce({ ...base, status: "completed" });
    const updated = await completeJob("b-1");
    expect(updated.status).toBe("completed");
    expect(incMock).toHaveBeenCalledWith("g-1");
  });

  it("rejects non-in_progress status", async () => {
    getMock.mockResolvedValueOnce({ ...base, status: "assigned" });
    await expect(completeJob("b-1")).rejects.toThrow(/cannot complete/);
  });
});

describe("cancelJob", () => {
  it("cancels without cutoff for ops", async () => {
    getMock
      .mockResolvedValueOnce({ ...base, status: "quoted" })
      .mockResolvedValueOnce({ ...base, status: "cancelled" });
    const updated = await cancelJob({ bookingId: "b-1", enforceCutoff: false, reason: "test" });
    expect(updated.status).toBe("cancelled");
  });

  it("rejects already-completed booking", async () => {
    getMock.mockResolvedValueOnce({ ...base, status: "completed" });
    await expect(
      cancelJob({ bookingId: "b-1", enforceCutoff: true }),
    ).rejects.toThrow(/cannot cancel/);
  });

  it("enforces 1hr cutoff when slot is in the next 30 mins", async () => {
    const inHalfHour = new Date(Date.now() + 30 * 60 * 1000);
    const slotDate = inHalfHour.toISOString().slice(0, 10);
    const slotTime = inHalfHour.toISOString().slice(11, 16);
    getMock.mockResolvedValueOnce({
      ...base,
      status: "assigned",
      slotDate,
      slotTime,
    });
    await expect(
      cancelJob({ bookingId: "b-1", enforceCutoff: true }),
    ).rejects.toThrow(/cutoff_exceeded/);
  });

  it("allows cancel when slot is days away", async () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const slotDate = inThreeDays.toISOString().slice(0, 10);
    getMock
      .mockResolvedValueOnce({
        ...base,
        status: "quoted",
        slotDate,
        slotTime: "10:00",
      })
      .mockResolvedValueOnce({ ...base, status: "cancelled" });
    const updated = await cancelJob({ bookingId: "b-1", enforceCutoff: true });
    expect(updated.status).toBe("cancelled");
  });
});
