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
 *
 * Surfaces image/document/audio media so the photo-upload flow (ops
 * "Request photos" → customer sends pictures in WhatsApp) can route them.
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
          image?: { id?: string; mime_type?: string; caption?: string; sha256?: string };
          document?: { id?: string; mime_type?: string; caption?: string; sha256?: string };
          audio?: { id?: string; mime_type?: string; sha256?: string };
        };
        if (!msg.from || !msg.id) continue;
        const type = (msg.type ?? "other") as InboundMessage["type"];
        const interactiveId =
          msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id;
        const mediaBlob = msg.image ?? msg.document ?? msg.audio;
        const media = mediaBlob?.id
          ? {
              id: mediaBlob.id,
              mimeType: mediaBlob.mime_type ?? "application/octet-stream",
              caption: (mediaBlob as { caption?: string }).caption,
              sha256: mediaBlob.sha256,
            }
          : undefined;
        result.push({
          from: msg.from,
          messageId: msg.id,
          timestamp: msg.timestamp ?? new Date().toISOString(),
          type,
          text: msg.text?.body,
          interactiveId,
          media,
          raw: msg,
        });
      }
    }
  }
  return result;
}

/**
 * Download the bytes of a Meta media object by id.
 *
 * Two-step dance:
 *   1. GET /{media_id}              → { url: "https://lookaside.facebook.com/..." }
 *   2. GET that url (with auth)     → bytes
 *
 * The intermediate URL is temporary (~5 min) and requires the same access
 * token on the second call. Throws on any non-2xx so callers can catch + audit.
 */
export async function downloadMediaBytes(mediaId: string): Promise<{
  bytes: Uint8Array;
  mimeType: string;
}> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN not set");

  const metaRes = await fetch(
    `https://graph.facebook.com/v23.0/${encodeURIComponent(mediaId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metaRes.ok) {
    throw new Error(`media metadata fetch failed: ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("media metadata had no url");

  const bytesRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!bytesRes.ok) {
    throw new Error(`media download failed: ${bytesRes.status}`);
  }
  const buf = new Uint8Array(await bytesRes.arrayBuffer());
  return { bytes: buf, mimeType: meta.mime_type ?? "application/octet-stream" };
}
