import { beforeEach, describe, expect, it, vi } from "vitest";

// We need to mock the heavy dependencies that intents.ts pulls in so the
// pure-logic tests can run in isolation. The router itself is the unit
// under test; everything below is fixture scaffolding.

vi.mock("@/lib/bookings/data", () => ({
  getBookingByShortId: vi.fn(),
  getBookingById: vi.fn(),
}));
vi.mock("@/lib/bookings/assign", () => ({
  respondToAssignment: vi.fn(),
}));
vi.mock("@/lib/notifications/outbox", () => ({
  notifyTemplate: vi.fn(async () => ({ outboxId: "o-1", messageId: "wamid.x" })),
  notifyText: vi.fn(async () => ({ outboxId: "o-1", messageId: "wamid.x" })),
  recordInbound: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({
  appendAuditEntry: vi.fn(),
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
import { notifyTemplate, notifyText, recordInbound } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";

const lookupMock = vi.mocked(getBookingByShortId);
const respondMock = vi.mocked(respondToAssignment);
const notifyTplMock = vi.mocked(notifyTemplate);
const notifyTextMock = vi.mocked(notifyText);
const inboundMock = vi.mocked(recordInbound);
const auditMock = vi.mocked(appendAuditEntry);

const booking = {
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
  notifyTplMock.mockReset();
  notifyTextMock.mockReset();
  inboundMock.mockReset();
  auditMock.mockReset();
  notifyTplMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
  notifyTextMock.mockResolvedValue({ outboxId: "o-1", messageId: "wamid.x" });
});

function inbound(opts: { text?: string; interactiveId?: string; from?: string }) {
  return {
    from: opts.from ?? "+919999999999",
    messageId: "m-1",
    timestamp: new Date().toISOString(),
    type: opts.interactiveId ? ("interactive" as const) : ("text" as const),
    text: opts.text,
    interactiveId: opts.interactiveId,
    raw: {},
  };
}

describe("handleInboundMessage", () => {
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

    expect(respondMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "decline" }),
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

  it("help text returns the help menu", async () => {
    await handleInboundMessage(inbound({ text: "help" }));
    expect(notifyTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+919999999999" }),
    );
  });

  it("track <id> returns a status summary when booking exists", async () => {
    lookupMock.mockResolvedValueOnce(booking);
    await handleInboundMessage(inbound({ text: "track MW-AB23CD" }));
    expect(notifyTextMock).toHaveBeenCalled();
    expect(notifyTextMock.mock.calls[0][0].body).toContain("MW-AB23CD");
  });

  it("track <id> says not found when missing", async () => {
    lookupMock.mockResolvedValueOnce(null);
    await handleInboundMessage(inbound({ text: "track MW-XYZ234" }));
    expect(notifyTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("No booking found") }),
    );
  });

  it("unknown text logs but does not reply", async () => {
    await handleInboundMessage(inbound({ text: "wat" }));
    expect(notifyTextMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "whatsapp_unknown_intent" }),
    );
  });
});
