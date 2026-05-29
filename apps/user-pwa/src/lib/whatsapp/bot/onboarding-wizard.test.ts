// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/audit/log", () => ({ appendAuditEntry: vi.fn() }));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o", messageId: "m" })),
  notifyText: vi.fn(async () => ({ outboxId: "o", messageId: "m" })),
}));
vi.mock("../client", () => ({
  downloadMediaBytes: vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/jpeg",
  })),
}));

// Supabase mock: storage upload OK; mechanics insert OK; garages insert
// returns a new id.
const mechanicInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
const garageInsert = vi.fn((_row: Record<string, unknown>) => ({
  select: () => ({
    single: async () => ({ data: { id: "g-new" }, error: null }),
  }),
}));
const storageUpload = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ upload: storageUpload }) },
    from: (table: string) =>
      table === "garages"
        ? { insert: garageInsert }
        : { insert: mechanicInsert },
  }),
}));

import {
  handleOnboardingMessage,
  isOnboardingEntry,
} from "./onboarding-wizard";

let tmp: string;
const cwdAtStart = process.cwd();
const PHONE = "+919999988888";

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "onboard-"));
  process.chdir(tmp);
  mechanicInsert.mockClear();
  garageInsert.mockClear();
  storageUpload.mockClear();
});
afterEach(() => {
  process.chdir(cwdAtStart);
  rmSync(tmp, { recursive: true, force: true });
});

describe("isOnboardingEntry", () => {
  it("matches the trigger words", () => {
    expect(isOnboardingEntry("onboard")).toBe(true);
    expect(isOnboardingEntry("REGISTER")).toBe(true);
    expect(isOnboardingEntry("partner")).toBe(true);
    expect(isOnboardingEntry("workshop signup")).toBe(true);
  });
  it("ignores unrelated text", () => {
    expect(isOnboardingEntry("book")).toBe(false);
    expect(isOnboardingEntry("hi there")).toBe(false);
  });
});

describe("onboarding wizard — happy path (12 steps)", () => {
  it("walks all steps and inserts mechanics + garages rows", async () => {
    let r = await handleOnboardingMessage({ phone: PHONE, text: "onboard" });
    expect(r.reply).toContain("workshop");

    r = await handleOnboardingMessage({ phone: PHONE, text: "Khan Auto Detailing" });
    expect(r.reply.toLowerCase()).toContain("owner");

    r = await handleOnboardingMessage({ phone: PHONE, text: "Imran Khan" });
    expect(r.reply.toLowerCase()).toContain("area");

    r = await handleOnboardingMessage({ phone: PHONE, text: "Rajbagh" });
    expect(r.reply.toLowerCase()).toContain("services");

    // Pick Scheduled Maintenance (1) + Detailing (3)
    r = await handleOnboardingMessage({ phone: PHONE, text: "1,3" });
    expect(r.reply.toLowerCase()).toContain("roadside");

    r = await handleOnboardingMessage({ phone: PHONE, text: "yes" });
    expect(r.reply.toLowerCase()).toContain("how far");

    r = await handleOnboardingMessage({ phone: PHONE, text: "2" }); // 10 km
    expect(r.reply.toLowerCase()).toContain("pickup");

    r = await handleOnboardingMessage({ phone: PHONE, text: "no" });
    expect(r.reply.toLowerCase()).toContain("working hours");

    r = await handleOnboardingMessage({ phone: PHONE, text: "9 AM - 8 PM" });
    expect(r.reply.toLowerCase()).toContain("weekly off");

    r = await handleOnboardingMessage({ phone: PHONE, text: "Friday" });
    expect(r.reply.toLowerCase()).toContain("verification document");

    // Step 10 — send the document as media.
    r = await handleOnboardingMessage({
      phone: PHONE,
      text: "",
      media: { id: "media-123", mimeType: "image/jpeg" },
    });
    expect(storageUpload).toHaveBeenCalled();
    expect(r.reply.toLowerCase()).toContain("confirm your whatsapp number");

    // Step 11 — confirm phone with YES → submit.
    r = await handleOnboardingMessage({ phone: PHONE, text: "yes" });
    expect(mechanicInsert).toHaveBeenCalledTimes(1);
    expect(garageInsert).toHaveBeenCalledTimes(1);
    expect(r.garageId).toBe("g-new");
    expect(r.reply).toContain("submitted");

    // Garage row carries the blueprint fields.
    const garageArg = garageInsert.mock.calls[0]![0];
    expect(garageArg.shop_name).toBe("Khan Auto Detailing");
    expect(garageArg.area).toBe("Rajbagh");
    expect(garageArg.rsa_available).toBe(true);
    expect(garageArg.rsa_radius_km).toBe(10);
    expect(garageArg.pickup_available).toBe(false);
    expect(garageArg.active).toBe(false);
    expect(garageArg.onboarding_status).toBe("pending_verification");
    expect(garageArg.service_buckets).toEqual([
      "scheduled_maintenance",
      "detailing",
    ]);
  });
});

describe("onboarding wizard — validation + escapes", () => {
  it("CANCEL clears the session", async () => {
    await handleOnboardingMessage({ phone: PHONE, text: "onboard" });
    const r = await handleOnboardingMessage({ phone: PHONE, text: "cancel" });
    expect(r.reply.toLowerCase()).toContain("cancelled");
    // No session now → empty reply.
    const r2 = await handleOnboardingMessage({ phone: PHONE, text: "hello" });
    expect(r2.reply).toBe("");
  });

  it("invalid services pick re-prompts", async () => {
    await handleOnboardingMessage({ phone: PHONE, text: "onboard" });
    await handleOnboardingMessage({ phone: PHONE, text: "Khan Auto" });
    await handleOnboardingMessage({ phone: PHONE, text: "Imran" });
    await handleOnboardingMessage({ phone: PHONE, text: "Rajbagh" });
    const r = await handleOnboardingMessage({ phone: PHONE, text: "nope" });
    expect(r.reply.toLowerCase()).toContain("comma-separated");
  });

  it("RSA=no skips the radius step", async () => {
    await handleOnboardingMessage({ phone: PHONE, text: "onboard" });
    await handleOnboardingMessage({ phone: PHONE, text: "Khan Auto" });
    await handleOnboardingMessage({ phone: PHONE, text: "Imran" });
    await handleOnboardingMessage({ phone: PHONE, text: "Rajbagh" });
    await handleOnboardingMessage({ phone: PHONE, text: "1" });
    const r = await handleOnboardingMessage({ phone: PHONE, text: "no" });
    expect(r.reply.toLowerCase()).toContain("pickup");
  });

  it("text instead of a document at the doc step re-prompts", async () => {
    await handleOnboardingMessage({ phone: PHONE, text: "onboard" });
    await handleOnboardingMessage({ phone: PHONE, text: "Khan Auto" });
    await handleOnboardingMessage({ phone: PHONE, text: "Imran" });
    await handleOnboardingMessage({ phone: PHONE, text: "Rajbagh" });
    await handleOnboardingMessage({ phone: PHONE, text: "1" });
    await handleOnboardingMessage({ phone: PHONE, text: "no" }); // RSA no
    await handleOnboardingMessage({ phone: PHONE, text: "no" }); // pickup no
    await handleOnboardingMessage({ phone: PHONE, text: "9-5" }); // hours
    await handleOnboardingMessage({ phone: PHONE, text: "Sunday" }); // weekly off
    const r = await handleOnboardingMessage({ phone: PHONE, text: "here is my aadhaar" });
    expect(r.reply.toLowerCase()).toContain("photo or pdf");
  });
});
