import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks: the router pulls in a lot of heavy deps. Default each to a happy
// no-op; individual tests override as needed.

vi.mock("@/lib/bookings/data", () => ({
  getBookingByShortId: vi.fn(),
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/assign", () => ({
  respondToAssignment: vi.fn(),
}));
vi.mock("@/lib/bookings/lifecycle", () => ({
  startJob: vi.fn(),
  completeJob: vi.fn(),
  cancelJob: vi.fn(),
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
import { getBookingByShortId } from "@/lib/bookings/data";
import { respondToAssignment } from "@/lib/bookings/assign";
import { startJob, completeJob } from "@/lib/bookings/lifecycle";
import { notifyTemplate, notifyText, recordInbound } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import { findGarageByPhone } from "@/lib/garage/data";
import { listGarageJobs } from "@/lib/garage/jobs";
import { getWizardState } from "./bot/state";
import { handleWizardMessage } from "./bot/wizard";

const lookupMock = vi.mocked(getBookingByShortId);
const respondMock = vi.mocked(respondToAssignment);
const startMock = vi.mocked(startJob);
const completeMock = vi.mocked(completeJob);
const notifyTplMock = vi.mocked(notifyTemplate);
const notifyTextMock = vi.mocked(notifyText);
const inboundMock = vi.mocked(recordInbound);
const auditMock = vi.mocked(appendAuditEntry);
const garageLookupMock = vi.mocked(findGarageByPhone);
const listJobsMock = vi.mocked(listGarageJobs);
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
  respondMock.mockReset();
  startMock.mockReset();
  completeMock.mockReset();
  notifyTplMock.mockReset();
  notifyTextMock.mockReset();
  inboundMock.mockReset();
  auditMock.mockReset();
  garageLookupMock.mockReset();
  listJobsMock.mockReset();
  wizardStateMock.mockReset();
  wizardMock.mockReset();
  notifyTplMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
  notifyTextMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
  garageLookupMock.mockResolvedValue(null); // default: sender is not a garage
  wizardStateMock.mockResolvedValue(null); // default: no wizard session
  wizardMock.mockResolvedValue({ reply: "" });
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
});
