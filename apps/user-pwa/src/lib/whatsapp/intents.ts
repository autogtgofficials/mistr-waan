import "server-only";
import { getBookingByShortId, getBookingById } from "@/lib/bookings/data";
import { respondToAssignment } from "@/lib/bookings/assign";
import { notifyTemplate, notifyText, recordInbound } from "@/lib/notifications/outbox";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEntry } from "@/lib/audit/log";
import type { InboundMessage } from "./types";
import { isValidShortId } from "@/lib/supabase/short-id";

/**
 * The router for inbound WhatsApp messages.
 *
 * Two flavours of intent we need to handle in Week 2:
 *   1. **Interactive button replies** from the `garage_new_job` template:
 *      payload `booking:<short_id>:accept` or `:decline`. These come back
 *      to us as `msg.interactiveId`.
 *   2. **Text commands** that ops/garage owners may type ad hoc:
 *      `track <short_id>`, `cancel <short_id>`, `help`. We respond with
 *      a status summary or a help blurb.
 *
 * The router never throws — anything unexpected becomes an audited
 * `unknown_intent` and a polite text reply. Meta retries on >5s or non-2xx,
 * so we must finish quickly.
 */

const BUTTON_RE = /^booking:([A-Z0-9-]+):(accept|decline)$/i;

export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  // Persist inbound for audit/debug. Booking lookup happens lazily below.
  await recordInbound({
    from: msg.from,
    messageId: msg.messageId,
    type: msg.type,
    body: msg.text ?? null,
    interactiveId: msg.interactiveId ?? null,
    raw: msg.raw,
  });

  const buttonId = msg.interactiveId ?? msg.text?.trim() ?? null;
  if (buttonId) {
    const m = buttonId.match(BUTTON_RE);
    if (m) {
      await handleGarageButton({
        shortId: m[1]!.toUpperCase(),
        outcome: m[2]!.toLowerCase() as "accept" | "decline",
        from: msg.from,
      });
      return;
    }
  }

  // Text intents — be forgiving with whitespace and case.
  const text = (msg.text ?? "").trim().toLowerCase();
  if (!text) return;

  if (text === "help" || text === "hi" || text === "hello" || text === "start") {
    await notifyText({
      to: msg.from,
      body: [
        "Mistr Waan — Kashmir's car care service.",
        "",
        "Reply with:",
        "• track <MW-XXXXXX> — booking status",
        "• cancel <MW-XXXXXX> — cancel a booking (>1hr before slot)",
        "• help — this message",
        "",
        "Or visit autogtg.com to book.",
      ].join("\n"),
    });
    return;
  }

  const trackMatch = text.match(/^track\s+(mw-[a-z0-9-]+)$/i);
  if (trackMatch) {
    await handleTrack({ from: msg.from, shortId: trackMatch[1]!.toUpperCase() });
    return;
  }

  // Unknown intent — log + polite reply.
  await appendAuditEntry({
    action: "whatsapp_unknown_intent",
    entityType: "whatsapp_message",
    entityId: msg.messageId,
    actor: msg.from,
    payload: { text: msg.text, interactiveId: msg.interactiveId },
    outcome: "success",
  });
  // Don't notifyText here — outside the 24h customer service window it'll fail
  // and we'd spam the outbox. The next inbound message opens a fresh session.
}

async function handleGarageButton(opts: {
  shortId: string;
  outcome: "accept" | "decline";
  from: string;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await appendAuditEntry({
      action: "whatsapp_garage_button",
      entityType: "booking",
      entityId: opts.shortId,
      actor: opts.from,
      outcome: "error",
      error: "invalid_short_id",
    });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking || !booking.garageId) {
    await appendAuditEntry({
      action: "whatsapp_garage_button",
      entityType: "booking",
      entityId: opts.shortId,
      actor: opts.from,
      outcome: "error",
      error: booking ? "no_garage_assigned" : "not_found",
    });
    return;
  }

  // Verify the sender is the garage we assigned. Garages can have multiple
  // phones (owner + branch) — accept either if it matches the row.
  const supabase = getSupabaseAdmin();
  const { data: garage } = await supabase
    .from("garages")
    .select("phone, whatsapp_phone, shop_name, owner_first_name")
    .eq("id", booking.garageId)
    .maybeSingle();
  const expectedPhones = [garage?.phone, garage?.whatsapp_phone].filter(
    (p): p is string => Boolean(p),
  );
  const normFrom = normalisePhone(opts.from);
  const senderOk = expectedPhones.some((p) => normalisePhone(p) === normFrom);
  if (!senderOk) {
    await appendAuditEntry({
      action: "whatsapp_garage_button",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { shortId: opts.shortId, outcome: opts.outcome },
      outcome: "error",
      error: "sender_not_assigned_garage",
    });
    return;
  }

  try {
    const updated = await respondToAssignment({
      bookingId: booking.id,
      garageId: booking.garageId,
      outcome: opts.outcome,
    });

    // Notify the customer.
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("id", booking.profileId)
      .maybeSingle();
    if (profile?.phone) {
      if (opts.outcome === "accept") {
        await notifyTemplate({
          to: profile.phone,
          template: "mechanic_assigned",
          variables: [
            garage?.shop_name ?? "your assigned garage",
            updated.shortId,
          ],
          bookingId: booking.id,
        });
      } else {
        await notifyTemplate({
          to: profile.phone,
          template: "garage_declined",
          variables: [
            profile.first_name ?? "there",
            updated.shortId,
          ],
          bookingId: booking.id,
        });
      }
    }

    await appendAuditEntry({
      action: "garage_respond_via_wa",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { outcome: opts.outcome, garageId: booking.garageId },
      before: { status: booking.status },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "garage_respond_via_wa",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { outcome: opts.outcome },
      outcome: "error",
      error: message,
    });
  }
}

async function handleTrack(opts: { from: string; shortId: string }): Promise<void> {
  if (!isValidShortId(opts.shortId)) return;
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking) {
    await notifyText({
      to: opts.from,
      body: `No booking found for ${opts.shortId}.`,
    });
    return;
  }
  const lines = [
    `Booking ${booking.shortId}`,
    `Status: ${booking.status.replace(/_/g, " ")}`,
    `Slot: ${booking.slotLabel}`,
  ];
  if (booking.total != null) lines.push(`Total: ₹${booking.total}`);
  if (booking.garage?.shopName) lines.push(`Garage: ${booking.garage.shopName}`);
  await notifyText({ to: opts.from, body: lines.join("\n"), bookingId: booking.id });
}

/** Strip non-digits so "+91 7889 686 682" and "917889686682" compare equal. */
function normalisePhone(p: string): string {
  return p.replace(/\D+/g, "");
}

/** Exported re-export so the webhook can find a booking by inbound metadata too. */
export { getBookingById };
