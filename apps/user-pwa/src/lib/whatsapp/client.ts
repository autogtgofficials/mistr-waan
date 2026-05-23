import "server-only";
import { metaProvider } from "./providers/meta";
import { getTemplate, type TemplateName } from "./templates";
import type { InboundMessage, SendResult, WhatsAppProvider } from "./types";

/**
 * Provider-agnostic WhatsApp facade. Reads WHATSAPP_PROVIDER from env;
 * default is Meta Cloud API. Other providers (AiSensy, Gupshup) plug in
 * the same shape and we swap by env var, not code change.
 */

function getProvider(): WhatsAppProvider {
  const provider = process.env.WHATSAPP_PROVIDER ?? "meta";
  switch (provider) {
    case "meta":
      return metaProvider;
    default:
      throw new Error(`Unknown WHATSAPP_PROVIDER: ${provider}`);
  }
}

export async function sendWhatsAppOtp(opts: {
  to: string;
  code: string;
}): Promise<SendResult> {
  const tpl = getTemplate("otp_login");
  return getProvider().sendTemplate({
    to: opts.to,
    templateName: tpl.name,
    languageCode: tpl.language,
    bodyVariables: [opts.code],
    buttonVariables: [{ subType: "url", index: 0, value: opts.code }],
  });
}

export async function sendWhatsAppTemplate(opts: {
  to: string;
  template: TemplateName;
  variables?: string[];
  /**
   * Dynamic quick-reply button payloads. Index matches the button position
   * in the template (0 = first button, 1 = second). The payload string is
   * what comes back to us via the webhook as `interactive.button_reply.id`.
   */
  buttonPayloads?: { index: number; payload: string }[];
}): Promise<SendResult> {
  const tpl = getTemplate(opts.template);
  return getProvider().sendTemplate({
    to: opts.to,
    templateName: tpl.name,
    languageCode: tpl.language,
    bodyVariables: opts.variables,
    buttonVariables: opts.buttonPayloads?.map((b) => ({
      subType: "quick_reply" as const,
      index: b.index,
      value: b.payload,
    })),
  });
}

export async function sendWhatsAppText(opts: {
  to: string;
  body: string;
}): Promise<SendResult> {
  return getProvider().sendText(opts);
}

/**
 * Parse a Meta webhook payload into our internal InboundMessage shape.
 * Returns [] if the payload is a status callback or otherwise has no inbound messages.
 */
export function parseInboundMessages(payload: unknown): InboundMessage[] {
  const result: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[] } })?.value;
      const messages = value?.messages ?? [];
      for (const m of messages) {
        const msg = m as {
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            button_reply?: { id?: string };
            list_reply?: { id?: string };
          };
        };
        if (!msg.from || !msg.id) continue;
        const type = (msg.type ?? "other") as InboundMessage["type"];
        const interactiveId =
          msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id;
        result.push({
          from: msg.from,
          messageId: msg.id,
          timestamp: msg.timestamp ?? new Date().toISOString(),
          type,
          text: msg.text?.body,
          interactiveId,
          raw: msg,
        });
      }
    }
  }
  return result;
}
