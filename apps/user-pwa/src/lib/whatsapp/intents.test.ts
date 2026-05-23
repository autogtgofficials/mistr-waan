import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks: the router pulls in a lot of heavy deps. Default each to a happy
// no-op; individual tests override as needed.

vi.mock("@/lib/bookings/data", () => ({
  getBookingByShortId: vi.fn(),
  getBookingById: vi.fn(),
  listBookingsForProfile: vi.fn(async () => []),
}));
vi.mock("@/lib/bookings/assign", () => ({
  respondToAssignment: vi.fn(),
}));
vi.mock("@/lib/bookings/lifecycle", () => ({
  startJob: vi.fn(),
  completeJob: vi.fn(),
  cancelJob: vi.fn(),
}));
vi.mock("@/lib/bookings/ratings", () => ({
  addBookingRating: vi.fn(),
}));
vi.mock("@/lib/auth/profile", () => ({
  findProfileByPhone: vi.fn(async () => null),
}));
vi.mock("@/lib/referrals/data", () => ({
  ensureReferralCode: vi.fn(async () => "ABC123"),
}));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o-1", messageId: "wamid.x" })),
  notifyText: vi.fn(async () => ({ outboxId: "o-1", messageId: "wamid.x" })),
  recordInbound: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
}));
vi.mock("@/lib/garage/data", () => ({
  findGarageByPhone: vi.fn(async () => null),
  setGarageActive: vi.fn(async () => undefined),
}));
vi.mock("@/lib/garage/jobs", () => ({
  listGarageJobs: vi.fn(async () => []),
}));
vi.mock("./bot/state", () => ({
  getWizardState: vi.fn(async () => null),
}));
vi.mock("./bot/wizard", () => ({
  handleWizardMessage: vi.fn(async () => ({ reply: "" })),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            table === "garages"
              ? Promise.resolve({
                  data: {
                    id: "g-1",
                    phone: "+919999999999",
                    whatsapp_phone: null,
                    shop_name: "Imran's Auto",
                    owner_first_name: "Imran",
                  },
                })
              : Promise.resolve({
                  data: { first_name: "Aaliyah", phone: "+916006617842" },
                }),
        }),
      }),
    }),
  }),
}));

import { handleInboundMessage } from "./intents";
import {
  getBookingByShortId,
  listBookingsForProfile,
} from "@/lib/bookings/data";
import { respondToAssignment } from "@/lib/bookings/assign";
import { startJob, completeJob } from "@/lib/bookings/lifecycle";
import { addBookingRating } from "@/lib/bookings/ratings";
import { notifyTemplate, notifyText, recordInbound } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { findGarageByPhone, setGarageActive } from "@/lib/garage/data";
import { listGarageJobs } from "@/lib/garage/jobs";
import { findProfileByPhone } from "@/lib/auth/profile";
import { ensureReferralCode } from "@/lib/referrals/data";
import { getWizardState } from "./bot/state";
import { handleWizardMessage } from "./bot/wizard";

const lookupMock = vi.mocked(getBookingByShortId);
const listBookingsMock = vi.mocked(listBookingsForProfile);
const respondMock = vi.mocked(respondToAssignment);
const startMock = vi.mocked(startJob);
const completeMock = vi.mocked(completeJob);
const rateMock = vi.mocked(addBookingRating);
const notifyTplMock = vi.mocked(notifyTemplate);
const notifyTextMock = vi.mocked(notifyText);
const inboundMock = vi.mocked(recordInbound);
const auditMock = vi.mocked(appendAuditEntry);
const garageLookupMock = vi.mocked(findGarageByPhone);
const setActiveMock = vi.mocked(setGarageActive);
const listJobsMock = vi.mocked(listGarageJobs);
const profileLookupMock = vi.mocked(findProfileByPhone);
const referralCodeMock = vi.mocked(ensureReferralCode);
const wizardStateMock = vi.mocked(getWizardState);
const wizardMock = vi.mocked(handleWizardMessage);

const sampleGarage = {
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
  serviceBuckets: ["detailing"],
  active: true,
};

const booking = {
  id: "b-1",
  shortId: "MW-AB23CD",
  profileId: "p-1",
  bucket: "detailing" as const,
  serviceIds: [],
  garageId: "g-1",
  slotDate: null,
  slotTime: null,
  slotLabel: "Tomorrow 10 AM",
  paymentMode: "cash" as const,
  total: 500,
  baseTotal: 500,
  status: "awaiting_garage" as const,
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
  inProgressAt: null,
  completedAt: null,
  cancelledAt: null,
};

beforeEach(() => {
  lookupMock.mockReset();
  listBookingsMock.mockReset();
  respondMock.mockReset();
  startMock.mockReset();
  completeMock.mockReset();
  rateMock.mockReset();
  notifyTplMock.mockReset();
  notifyTextMock.mockReset();
  inboundMock.mockReset();
  auditMock.mockReset();
  garageLookupMock.mockReset();
  setActiveMock.mockReset();
  listJobsMock.mockReset();
  profileLookupMock.mockReset();
  referralCodeMock.mockReset();
  wizardStateMock.mockReset();
  wizardMock.mockReset();
  notifyTplMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
  notifyTextMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
  garageLookupMock.mockResolvedValue(null);
  wizardStateMock.mockResolvedValue(null);
  wizardMock.mockResolvedValue({ reply: "" });
  listBookingsMock.mockResolvedValue([]);
  profileLookupMock.mockResolvedValue(null);
  referralCodeMock.mockResolvedValue("ABC123");
});

function inbound(opts: { text?: string; interactiveId?: string; from?: string }) {
  return {
    from: opts.from ?? "+916006617842", // default to customer phone
    messageId: "m-1",
    timestamp: new Date().toISOString(),
    type: opts.interactiveId ? ("interactive" as const) : ("text" as const),
    text: opts.text,
    interactiveId: opts.interactiveId,
    raw: {},
  };
}

describe("handleInboundMessage — button replies", () => {
  it("records inbound for every message", async () => {
    await handleInboundMessage(inbound({ text: "hi" }));
    expect(inboundMock).toHaveBeenCalled();
  });

  it("garage accept button advances booking to assigned and notifies customer", async () => {
    lookupMock.mockResolvedValueOnce(booking);
    respondMock.mockResolvedValueOnce({ ...booking, status: "assigned" });

    await handleInboundMessage(
      inbound({ interactiveId: "booking:MW-AB23CD:accept", from: "+919999999999" }),
    );

    expect(respondMock).toHaveBeenCalledWith({
      bookingId: "b-1",
      garageId: "g-1",
      outcome: "accept",
    });
    expect(notifyTplMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "mechanic_assigned" }),
    );
  });

  it("garage decline button transitions to declined_by_garage", async () => {
    lookupMock.mockResolvedValueOnce(booking);
    respondMock.mockResolvedValueOnce({ ...booking, status: "declined_by_garage" });

    await handleInboundMessage(
      inbound({ interactiveId: "booking:MW-AB23CD:decline", from: "+919999999999" }),
    );

    expect(notifyTplMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "garage_declined" }),
    );
  });

  it("ignores button reply from a phone that isn't the assigned garage", async () => {
    lookupMock.mockResolvedValueOnce(booking);

    await handleInboundMessage(
      inbound({ interactiveId: "booking:MW-AB23CD:accept", from: "+910000000000" }),
    );
    expect(respondMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "sender_not_assigned_garage" }),
    );
  });
});

describe("handleInboundMessage — customer text commands", () => {
  it("help returns the customer menu", async () => {
    await handleInboundMessage(inbound({ text: "help" }));
    const body = notifyTextMock.mock.calls[0]?.[0].body ?? "";
    expect(body).toContain("BOOK");
    expect(body).toContain("TRACK");
  });

  it("track <id> returns a status summary when booking exists", async () => {
    lookupMock.mockResolvedValueOnce(booking);
    await handleInboundMessage(inbound({ text: "track MW-AB23CD" }));
    expect(notifyTextMock).toHaveBeenCalled();
    expect(notifyTextMock.mock.calls[0]![0].body).toContain("MW-AB23CD");
  });

  it("track <id> says not found when missing", async () => {
    lookupMock.mockResolvedValueOnce(null);
    await handleInboundMessage(inbound({ text: "track MW-XYZ234" }));
    expect(notifyTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("No booking found") }),
    );
  });

  it("unknown text replies with help nudge + audits as unknown_intent", async () => {
    await handleInboundMessage(inbound({ text: "wat" }));
    expect(notifyTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("BOOK"),
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "whatsapp_unknown_intent" }),
    );
  });

  it("'book' triggers the wizard", async () => {
    wizardMock.mockResolvedValueOnce({ reply: "Hi! What service?" });
    await handleInboundMessage(inbound({ text: "book" }));
    expect(wizardMock).toHaveBeenCalledWith({
      phone: "+916006617842",
      text: "book",
    });
    expect(notifyTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Hi! What service?" }),
    );
  });

  it("in-progress wizard session routes free text to the wizard", async () => {
    wizardStateMock.mockResolvedValueOnce({
      phone: "+916006617842",
      step: "PICKING_BUCKET",
      updatedAt: Date.now(),
    });
    wizardMock.mockResolvedValueOnce({ reply: "Please pick 1, 2, or 3." });
    await handleInboundMessage(inbound({ text: "abc" }));
    expect(wizardMock).toHaveBeenCalled();
    expect(notifyTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Please pick 1, 2, or 3." }),
    );
  });
});

describe("handleInboundMessage — garage text commands", () => {
  beforeEach(() => {
    garageLookupMock.mockResolvedValue(sampleGarage);
  });

  it("'jobs' lists active garage jobs", async () => {
    listJobsMock.mockResolvedValueOnce([
      {
        ...booking,
        shortId: "MW-AB23CD",
        status: "assigned",
        services: [
          { id: "foam-wash", name: "Foam wash", basePrice: 500, durationLabel: null, blurb: null, isQuoted: false },
        ],
        customerLabel: "Aaliyah",
        customerArea: "—",
        customerPhoneMasked: "•••• 7842",
        commissionCut: 60,
      },
    ]);
    await handleInboundMessage(inbound({ text: "jobs", from: "+919999999999" }));
    const body = notifyTextMock.mock.calls[0]?.[0].body ?? "";
    expect(body).toContain("MW-AB23CD");
    expect(body).toContain("START");
  });

  it("'start MW-XX' moves the job to in_progress + notifies customer", async () => {
    lookupMock.mockResolvedValueOnce(booking);
    startMock.mockResolvedValueOnce({ ...booking, status: "in_progress" });
    await handleInboundMessage(
      inbound({ text: "start MW-AB23CD", from: "+919999999999" }),
    );
    expect(startMock).toHaveBeenCalledWith("b-1");
    expect(notifyTplMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "job_started" }),
    );
  });

  it("'complete MW-XX' moves the job to completed + sends job_complete template", async () => {
    lookupMock.mockResolvedValueOnce({ ...booking, status: "in_progress" });
    completeMock.mockResolvedValueOnce({ ...booking, status: "completed" });
    await handleInboundMessage(
      inbound({ text: "complete MW-AB23CD", from: "+919999999999" }),
    );
    expect(completeMock).toHaveBeenCalledWith("b-1");
    expect(notifyTplMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "job_complete" }),
    );
  });

  it("'accept MW-XX' (text) = button accept", async () => {
    lookupMock.mockResolvedValueOnce(booking);
    respondMock.mockResolvedValueOnce({ ...booking, status: "assigned" });
    await handleInboundMessage(
      inbound({ text: "accept MW-AB23CD", from: "+919999999999" }),
    );
    expect(respondMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "accept" }),
    );
  });

  it("'help' returns the garage-flavoured menu (mentions JOBS)", async () => {
    await handleInboundMessage(inbound({ text: "help", from: "+919999999999" }));
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("JOBS");
  });

  it("garage trying to start a booking that isn't theirs gets rejected", async () => {
    lookupMock.mockResolvedValueOnce({ ...booking, garageId: "g-other" });
    await handleInboundMessage(
      inbound({ text: "start MW-AB23CD", from: "+919999999999" }),
    );
    expect(startMock).not.toHaveBeenCalled();
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("isn't assigned");
  });

  it("EARNINGS returns a 30-day summary", async () => {
    listJobsMock.mockResolvedValueOnce([
      {
        ...booking,
        status: "completed",
        completedAt: new Date().toISOString(),
        total: 2000,
        commissionCut: 240,
        paymentMode: "cash",
        services: [],
        customerLabel: "X",
        customerArea: "—",
        customerPhoneMasked: "•••• 0000",
      },
    ]);
    await handleInboundMessage(inbound({ text: "earnings", from: "+919999999999" }));
    const body = notifyTextMock.mock.calls[0]?.[0].body ?? "";
    expect(body).toContain("Imran's Auto");
    expect(body).toContain("Completed jobs: 1");
    // cash commission should be flagged as owed
    expect(body).toContain("Commission owed");
  });

  it("PAUSE flips active=false + replies confirmation", async () => {
    await handleInboundMessage(inbound({ text: "pause", from: "+919999999999" }));
    expect(setActiveMock).toHaveBeenCalledWith("g-1", false);
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("Paused");
  });

  it("PAUSE is a no-op + tells you when already paused", async () => {
    garageLookupMock.mockResolvedValue({ ...sampleGarage, active: false });
    await handleInboundMessage(inbound({ text: "pause", from: "+919999999999" }));
    expect(setActiveMock).not.toHaveBeenCalled();
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("already paused");
  });

  it("RESUME flips active=true", async () => {
    garageLookupMock.mockResolvedValue({ ...sampleGarage, active: false });
    await handleInboundMessage(inbound({ text: "resume", from: "+919999999999" }));
    expect(setActiveMock).toHaveBeenCalledWith("g-1", true);
  });
});

describe("handleInboundMessage — customer extended commands", () => {
  it("MY BOOKINGS lists recent bookings for a known phone", async () => {
    profileLookupMock.mockResolvedValueOnce({
      id: "p-1",
      phone: "+916006617842",
      firstName: "Aaliyah",
      language: null,
      referralCode: null,
      referredBy: null,
      loyaltyPoints: 0,
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
    });
    listBookingsMock.mockResolvedValueOnce([
      { ...booking, shortId: "MW-AAAAAA", status: "completed", total: 500 },
      { ...booking, shortId: "MW-BBBBBB", status: "queued_for_call", total: null },
    ]);
    await handleInboundMessage(inbound({ text: "my bookings" }));
    const body = notifyTextMock.mock.calls[0]?.[0].body ?? "";
    expect(body).toContain("MW-AAAAAA");
    expect(body).toContain("MW-BBBBBB");
  });

  it("MY BOOKINGS for unknown phone replies with BOOK nudge", async () => {
    profileLookupMock.mockResolvedValueOnce(null);
    await handleInboundMessage(inbound({ text: "bookings" }));
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("Reply BOOK");
  });

  it("REFERRAL returns code + loyalty points for a known phone", async () => {
    profileLookupMock.mockResolvedValueOnce({
      id: "p-1",
      phone: "+916006617842",
      firstName: "Aaliyah",
      language: null,
      referralCode: "ABC123",
      referredBy: null,
      loyaltyPoints: 200,
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
    });
    referralCodeMock.mockResolvedValueOnce("ABC123");
    await handleInboundMessage(inbound({ text: "referral" }));
    const body = notifyTextMock.mock.calls[0]?.[0].body ?? "";
    expect(body).toContain("ABC123");
    expect(body).toContain("Loyalty points: 200");
  });

  it("RATE MW-XXX 5 great service calls addBookingRating with the parsed args", async () => {
    lookupMock.mockResolvedValueOnce({ ...booking, status: "completed" });
    rateMock.mockResolvedValueOnce({ ...booking, ratingValue: 5 });
    await handleInboundMessage(
      inbound({ text: "rate MW-AB23CD 5 fantastic work" }),
    );
    expect(rateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "b-1",
        score: 5,
        comment: "fantastic work",
      }),
    );
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("5/5");
  });

  it("RATE rejects scores outside 1-5 by falling through to unknown intent", async () => {
    await handleInboundMessage(inbound({ text: "rate MW-AB23CD 7" }));
    expect(rateMock).not.toHaveBeenCalled();
    // The regex requires [1-5], so this hits the unknown-intent path
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "whatsapp_unknown_intent" }),
    );
  });

  it("RATE on someone else's booking is rejected by phone-match", async () => {
    lookupMock.mockResolvedValueOnce({
      ...booking,
      status: "completed",
      profileId: "p-other",
    });
    await handleInboundMessage(
      inbound({ text: "rate MW-AB23CD 5", from: "+910000000000" }),
    );
    expect(rateMock).not.toHaveBeenCalled();
    expect(notifyTextMock.mock.calls[0]?.[0].body).toContain("can't rate");
  });
});
