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

// Stub Supabase services lookup — return a known catalog deterministically.
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

describe("wizard state machine", () => {
  it("'book' from cold starts the bucket pick", async () => {
    const res = await handleWizardMessage({ phone: PHONE, text: "book" });
    expect(res.reply).toContain("What service do you need");
    expect(res.reply).toContain("Detailing");
  });

  it("unrelated text without a session returns empty (caller falls through)", async () => {
    const res = await handleWizardMessage({ phone: PHONE, text: "what's up" });
    expect(res.reply).toBe("");
  });

  it("invalid bucket choice re-prompts", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    const res = await handleWizardMessage({ phone: PHONE, text: "9" });
    expect(res.reply).toContain("1, 2, or 3");
  });

  it("detailing → service → slot → payment → confirm creates a booking", async () => {
    profileMock.mockResolvedValueOnce({
      id: "p-1",
      phone: PHONE,
      firstName: null,
      language: null,
      referralCode: null,
      referredBy: null,
      loyaltyPoints: 0,
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
    });
    createMock.mockResolvedValueOnce({
      id: "b-1",
      shortId: "MW-XYZ234",
      profileId: "p-1",
      bucket: "detailing",
      serviceIds: ["foam-wash"],
      garageId: null,
      slotDate: null,
      slotTime: null,
      slotLabel: "Tomorrow morning (10 AM)",
      paymentMode: "cash",
      total: 500,
      baseTotal: 500,
      status: "queued_for_call",
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
    });

    let r = await handleWizardMessage({ phone: PHONE, text: "book" });
    expect(r.reply).toContain("What service");
    r = await handleWizardMessage({ phone: PHONE, text: "1" });
    expect(r.reply).toContain("Foam wash");
    r = await handleWizardMessage({ phone: PHONE, text: "1" });
    expect(r.reply).toContain("When works");
    r = await handleWizardMessage({ phone: PHONE, text: "2" });
    expect(r.reply).toContain("pay");
    r = await handleWizardMessage({ phone: PHONE, text: "1" });
    expect(r.reply).toContain("Booking summary");
    r = await handleWizardMessage({ phone: PHONE, text: "confirm" });
    expect(r.reply).toContain("MW-XYZ234");
    expect(r.done?.bookingShortId).toBe("MW-XYZ234");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "detailing",
        serviceIds: ["foam-wash"],
        paymentMode: "cash",
        slotLabel: "Tomorrow morning (10 AM)",
      }),
    );
  });

  it("repairs path asks for description (no service pick)", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    const r = await handleWizardMessage({ phone: PHONE, text: "2" });
    expect(r.reply).toContain("Describe");
    expect(r.reply).toContain("Repairs");
  });

  it("repairs description too short re-prompts", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "2" });
    const r = await handleWizardMessage({ phone: PHONE, text: "hi" });
    expect(r.reply).toContain("between 5 and 500");
  });

  it("CANCEL clears state at any step", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "1" });
    const r = await handleWizardMessage({ phone: PHONE, text: "cancel" });
    expect(r.reply).toContain("Booking cancelled");
    // Now BOOK should start fresh
    const r2 = await handleWizardMessage({ phone: PHONE, text: "what" });
    expect(r2.reply).toBe(""); // no session
  });

  it("BOOK mid-session restarts cleanly", async () => {
    await handleWizardMessage({ phone: PHONE, text: "book" });
    await handleWizardMessage({ phone: PHONE, text: "1" }); // detailing
    await handleWizardMessage({ phone: PHONE, text: "1" }); // foam wash
    const r = await handleWizardMessage({ phone: PHONE, text: "book" });
    expect(r.reply).toContain("What service do you need");
  });
});
