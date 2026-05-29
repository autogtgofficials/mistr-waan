// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCustomerSession: vi.fn(),
  getOpsSession: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/photos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bookings/photos")>(
    "@/lib/bookings/photos",
  );
  return {
    ...actual,
    uploadBookingPhoto: vi.fn(),
    listBookingPhotos: vi.fn(),
    signPhotoUrls: vi.fn(
      async (photos: Awaited<ReturnType<typeof actual.listBookingPhotos>>) =>
        photos.map((p) => ({ ...p, signedUrl: "https://x" })),
    ),
  };
});
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));

import { GET, POST } from "./route";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import {
  uploadBookingPhoto,
  listBookingPhotos,
  signPhotoUrls,
} from "@/lib/bookings/photos";

const customerMock = vi.mocked(getCustomerSession);
const opsMock = vi.mocked(getOpsSession);
const bookingMock = vi.mocked(getBookingById);
const uploadMock = vi.mocked(uploadBookingPhoto);
const listMock = vi.mocked(listBookingPhotos);
const signMock = vi.mocked(signPhotoUrls);

beforeEach(() => {
  customerMock.mockReset();
  opsMock.mockReset();
  bookingMock.mockReset();
  uploadMock.mockReset();
  listMock.mockReset();
  signMock.mockReset();
  signMock.mockImplementation(async (photos) =>
    photos.map((p) => ({ ...p, signedUrl: "https://x" })),
  );
});

const sample = {
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

const ctx = { params: Promise.resolve({ id: "b-1" }) };

describe("GET /api/bookings/[id]/photos", () => {
  it("401s without any session", async () => {
    customerMock.mockResolvedValueOnce(null);
    opsMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(401);
  });

  it("403s when customer asks for someone else's booking", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-2", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(sample);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(403);
  });

  it("lists photos with signed URLs for the booking owner", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(sample);
    listMock.mockResolvedValueOnce([
      {
        id: "ph-1",
        bookingId: "b-1",
        storagePath: "b-1/a.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1234,
        uploadedAt: new Date().toISOString(),
      },
    ]);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { photos: { signedUrl: string }[] };
    expect(body.photos[0].signedUrl).toBe("https://x");
  });
});

describe("POST /api/bookings/[id]/photos", () => {
  it("401s without any session", async () => {
    customerMock.mockResolvedValueOnce(null);
    opsMock.mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.append("file", new File(["x"], "x.jpg", { type: "image/jpeg" }));
    const res = await POST(
      new Request("http://x", { method: "POST", body: fd }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("400s when file missing", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(sample);
    const fd = new FormData();
    const res = await POST(
      new Request("http://x", { method: "POST", body: fd }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("file_required");
  });

  it("uploads + returns 201 for the booking owner", async () => {
    customerMock.mockResolvedValueOnce({ sub: "p-1", role: "customer", phone: "+91x" });
    opsMock.mockResolvedValueOnce(null);
    bookingMock.mockResolvedValueOnce(sample);
    uploadMock.mockResolvedValueOnce({
      id: "ph-1",
      bookingId: "b-1",
      storagePath: "b-1/a.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1,
      uploadedAt: new Date().toISOString(),
    });
    const fd = new FormData();
    fd.append("file", new File(["x"], "x.jpg", { type: "image/jpeg" }));
    const res = await POST(
      new Request("http://x", { method: "POST", body: fd }),
      ctx,
    );
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(uploadMock).toHaveBeenCalled();
  });
});
