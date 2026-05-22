import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp/client";
import type { TemplateName } from "@/lib/whatsapp/templates";
import type { Json } from "@/lib/supabase/types";

/**
 * Send a WhatsApp template and record the attempt in `notifications_outbox`.
 *
 * Persists the outbox row regardless of send outcome:
 *   - success → state='sent', provider_message_id set, sent_at=now
 *   - failure → state='failed', state_detail=<error>
 *
 * The booking_id is optional because some sends (OTP) don't have one.
 *
 * Returns the outbox row id and the provider message id (if any). Never throws —
 * notification failures must not block the booking mutation flow.
 */
export async function notifyTemplate(opts: {
  to: string;
  template: TemplateName;
  variables?: string[];
  buttonPayloads?: { index: number; payload: string }[];
  bookingId?: string | null;
}): Promise<{ outboxId: string | null; messageId: string | null; error?: string }> {
  const supabase = getSupabaseAdmin();
  // Insert pending row first so we don't lose track if the network call hangs.
  const { data: pending, error: insertError } = await supabase
    .from("notifications_outbox")
    .insert({
      channel: "whatsapp",
      direction: "outbound",
      to_phone: opts.to,
      template_name: opts.template,
      variables: (opts.variables ? { body: opts.variables, buttons: opts.buttonPayloads ?? [] } : null) as Json,
      booking_id: opts.bookingId ?? null,
      provider: "meta",
      state: "queued",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[outbox] insert failed", insertError.message);
  }
  const outboxId = pending?.id ?? null;

  try {
    const res = await sendWhatsAppTemplate({
      to: opts.to,
      template: opts.template,
      variables: opts.variables,
      buttonPayloads: opts.buttonPayloads,
    });
    if (outboxId) {
      await supabase
        .from("notifications_outbox")
        .update({
          provider_message_id: res.messageId,
          state: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", outboxId);
    }
    return { outboxId, messageId: res.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[outbox] send ${opts.template} failed`, message);
    if (outboxId) {
      await supabase
        .from("notifications_outbox")
        .update({ state: "failed", state_detail: message })
        .eq("id", outboxId);
    }
    return { outboxId, messageId: null, error: message };
  }
}

/**
 * Free-text variant used by the bot in reply to inbound messages
 * (e.g. "Sorry, command not recognised"). Outside the template window
 * this requires being inside a 24h customer-service session.
 */
export async function notifyText(opts: {
  to: string;
  body: string;
  bookingId?: string | null;
}): Promise<{ outboxId: string | null; messageId: string | null; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: pending } = await supabase
    .from("notifications_outbox")
    .insert({
      channel: "whatsapp",
      direction: "outbound",
      to_phone: opts.to,
      body: opts.body,
      booking_id: opts.bookingId ?? null,
      provider: "meta",
      state: "queued",
    })
    .select("id")
    .single();
  const outboxId = pending?.id ?? null;

  try {
    const res = await sendWhatsAppText({ to: opts.to, body: opts.body });
    if (outboxId) {
      await supabase
        .from("notifications_outbox")
        .update({
          provider_message_id: res.messageId,
          state: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", outboxId);
    }
    return { outboxId, messageId: res.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (outboxId) {
      await supabase
        .from("notifications_outbox")
        .update({ state: "failed", state_detail: message })
        .eq("id", outboxId);
    }
    return { outboxId, messageId: null, error: message };
  }
}

/**
 * Record an inbound message in the outbox for audit/debug. Called from
 * the WhatsApp webhook for every message we receive.
 */
export async function recordInbound(opts: {
  from: string;
  messageId: string;
  type: string;
  body?: string | null;
  interactiveId?: string | null;
  raw: unknown;
  bookingId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("notifications_outbox").insert({
    channel: "whatsapp",
    direction: "inbound",
    from_phone: opts.from,
    provider: "meta",
    provider_message_id: opts.messageId,
    body: opts.body ?? null,
    template_name: opts.interactiveId ?? null,
    raw_payload: (opts.raw ?? null) as Json,
    booking_id: opts.bookingId ?? null,
    state: "delivered",
  });
  if (error) {
    console.error("[outbox] inbound insert failed", error.message);
  }
}
