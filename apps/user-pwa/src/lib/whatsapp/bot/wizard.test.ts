// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/auth/profile", () => ({
  upsertProfileByPhone: vi.fn(),
}));
vi.mock("@/lib/bookings/data", () => ({
  createBooking: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o", messageId: "m" })),
}));

// Garage data layer — only the two helpers the wizard calls.
vi.mock("@/lib/garage/data", () => ({
  listActiveAreas: vi.fn(async () => ["Rajbagh", "Hyderpora"]),
  listGaragesByAreaAndBucket: vi.fn(async () => [
    {
      id: "g-1",
      slug: "g-imran-k",
      shopName: "Imran's Auto",
      ownerFirstName: "Imran",
      ownerLastName: "K",
      area: "Rajbagh",
      fullAddress: "Rajbagh, Srinagar",
      phone: "+919999999999",
      whatsappPhone: null,
      rating: 4.8,
      jobsCompleted: 12,
      commissionPct: 12,
      serviceBuckets: ["detailing", "repairs", "scheduled_maintenance"],
      active: true,
      onboardingStatus: null,
      workingHours: null,
      weeklyOff: null,
      rsaAvailable: null,
      rsaRadiusKm: null,
      pickupAvailable: null,
      verificationDocPath: null,
    },
  ]),
}));

// Supabase stub — services lookup. Returns car-prefixed names so the
// maintenance filter (state.vehicleType === "car" → "Car: " prefix) works
// when those tests run; also returns a couple of detailing items.
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { id: "foam-wash", name: "Foam wash", base_price: 500, is_quoted: false },
                  { id: "polish", name: "Polish + wax", base_price: 2500, is_quoted: false },
                  { id: "car-oil-change", name: "Car: Engine oil change", base_price: 1500, is_quoted: false },
                  { id: "bike-oil-change", name: "Bike: Engine oil change", base_price: 600, is_quoted: false },
                ],
              }),
          }),
        }),
      }),
    }),
  }),
}));

import { handleWizardMessage } from "./wizard";
import { upsertProfileByPhone } from "@/lib/auth/profile";
import { createBooking } from "@/lib/bookings/data";

const profileMock = vi.mocked(upsertProfileByPhone);
const createMock = vi.mocked(createBooking);

let tmp: string;
const cwdAtStart = process.cwd();
const PHONE = "+916006617842";

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "wiztest-"));
  process.chdir(tmp);
  profileMock.mockReset();
  createMock.mockReset();
});
afterEach(() => {
  process.chdir(cwdAtStart);
  rmSync(tmp, { recursive: true, force: true });
});

function sampleBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-1",
    shortId: "MW-XYZ234",
    profileId: "p-1",
    bucket: "detailing" as const,
    serviceIds: ["foam-wash"],
    garageId: "g-1",
    slotDate: null,
    slotTime: null,
    slotLabel: "Tomorrow morning (10 AM)",
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
    ...overrides,
  };
}

const sampleProfile = {
  id: "p-1",
  phone: PHONE,
  firstName: null,
  language: null,
  referralCode: null,
  referredBy: null,
  loyaltyPoints: 0,
  createdAt: new Date().toISOString(),
  lastSeenAt: null,
};

describe("customer wizard — entry + escape", () => {
  it("'book' from cold starts the module pick", async () => {
    const res = await handleWizardMessage({ phone: PHONE, text: "book" });
    expect(res.reply).toContain("What do you need today");
    expect(res.reply).toContain("Maintenance");
    expect(res.reply).toContain("Roadside Assistance");
  });

  it("unrelated text without a session returns empty (caller falls through)", async () => {
    const res = await handleWizardMessage({ phone: PHONE, text: "what's up" });
    expect(res.reply).toBe("");
  });

  it("invalid module choice re-prompts", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    const res = await handleWizardMessage({ phone: PHONE, text: "9" });
    expect(res.reply).toContain("1, 2, or 3");
  });

  it("CANCEL clears state at any step", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "1" });
    const r = await handleWizardMessage({ phone: PHONE, text: "cancel" });
    expect(r.reply).toContain("Booking cancelled");
    const r2 = await handleWizardMessage({ phone: PHONE, text: "what" });
    expect(r2.reply).toBe("");
  });

  it("BOOK mid-session restarts cleanly at module pick", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "3" }); // Additional
    await handleWizardMessage({ phone: PHONE, text: "1" }); // Detailing
    const r = await handleWizardMessage({ phone: PHONE, text: "book" });
    expect(r.reply).toContain("What do you need today");
  });
});

describe("customer wizard — Additional → Detailing full happy path", () => {
  it("walks module → bucket → service → area → garage → slot → vehicle → payment → confirm", async () => {
    profileMock.mockResolvedValueOnce(sampleProfile);
    createMock.mockResolvedValueOnce(sampleBooking());

    let r = await handleWizardMessage({ phone: PHONE, text: "book" });
    expect(r.reply).toContain("What do you need today");
    r = await handleWizardMessage({ phone: PHONE, text: "3" }); // Additional
    expect(r.reply).toContain("additional service");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // Detailing
    expect(r.reply).toContain("Foam wash");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // Foam wash
    expect(r.reply).toContain("Which area");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // Rajbagh
    expect(r.reply).toContain("Imran's Auto");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // pick garage
    expect(r.reply).toContain("When works");
    r = await handleWizardMessage({ phone: PHONE, text: "2" }); // tomorrow morning
    expect(r.reply).toContain("car details");
    r = await handleWizardMessage({ phone: PHONE, text: "Maruti, Swift, JK01AB1234" });
    expect(r.reply).toContain("pay");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // cash
    expect(r.reply).toContain("Booking summary");
    expect(r.reply).toContain("Imran's Auto");
    expect(r.reply).toContain("Maruti");
    r = await handleWizardMessage({ phone: PHONE, text: "confirm" });
    expect(r.reply).toContain("MW-XYZ234");
    expect(r.done?.bookingShortId).toBe("MW-XYZ234");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        garageId: "g-1",
        paymentMode: "cash",
        slotLabel: "Tomorrow morning (10 AM)",
        vehicleType: "car",
        vehicleBrand: "Maruti",
        vehicleModel: "Swift",
        vehicleRegistration: "JK01AB1234",
      }),
    );
  });
});

describe("customer wizard — Maintenance branch", () => {
  it("'book' → 1 (Maintenance) → 2 (Bike) → asks for bike maintenance service", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    let r = await handleWizardMessage({ phone: PHONE, text: "1" }); // Maintenance
    expect(r.reply).toContain("What vehicle");
    r = await handleWizardMessage({ phone: PHONE, text: "2" }); // Bike
    expect(r.reply).toContain("Bike maintenance");
    expect(r.reply).toContain("Engine oil change");
  });
});

describe("customer wizard — RSA branch (short-circuit slot)", () => {
  it("'book' → 2 (RSA) → 1 (Car) → service → area → garage → vehicle → payment → confirm", async () => {
    profileMock.mockResolvedValueOnce(sampleProfile);
    createMock.mockResolvedValueOnce(
      sampleBooking({ bucket: "rsa", shortId: "MW-RSA001", slotLabel: "ASAP (RSA)" }),
    );

    let r = await handleWizardMessage({ phone: PHONE, text: "book" });
    r = await handleWizardMessage({ phone: PHONE, text: "2" }); // RSA
    expect(r.reply).toContain("What vehicle");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // Car
    expect(r.reply).toContain("What's the emergency");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // pick first service
    expect(r.reply).toContain("Which area");
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // area
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // garage
    // RSA skips slot picker → straight to vehicle details
    expect(r.reply).toContain("car details");
    r = await handleWizardMessage({ phone: PHONE, text: "Maruti, Swift" });
    r = await handleWizardMessage({ phone: PHONE, text: "1" }); // cash
    r = await handleWizardMessage({ phone: PHONE, text: "confirm" });
    expect(r.reply).toContain("MW-RSA001");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "rsa",
        slotLabel: "ASAP (RSA)",
        vehicleType: "car",
      }),
    );
  });
});

describe("customer wizard — Additional → Repairs branch", () => {
  it("3 → 2 (Repairs) asks for free-text description", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "3" }); // Additional
    const r = await handleWizardMessage({ phone: PHONE, text: "2" }); // Repairs
    expect(r.reply).toContain("Describe");
    expect(r.reply).toContain("Repairs");
  });

  it("repairs description too short re-prompts", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "3" });
    await handleWizardMessage({ phone: PHONE, text: "2" });
    const r = await handleWizardMessage({ phone: PHONE, text: "hi" });
    expect(r.reply).toContain("between 5 and 500");
  });
});
