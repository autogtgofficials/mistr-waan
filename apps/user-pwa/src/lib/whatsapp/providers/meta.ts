import "server-only";
import { getTemplate } from "../templates";
import { toMetaRecipient } from "../phone";
import {
  WhatsAppError,
  type SendResult,
  type SendTemplateOptions,
  type SendTextOptions,
  type WhatsAppProvider,
} from "../types";

const GRAPH_VERSION = "v23.0";

interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  baseUrl?: string;
}

function readConfig(): MetaConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken) throw new WhatsAppError("WHATSAPP_ACCESS_TOKEN not set", "config", 500);
  if (!phoneNumberId) throw new WhatsAppError("WHATSAPP_PHONE_NUMBER_ID not set", "config", 500);
  return {
    accessToken,
    phoneNumberId,
    baseUrl: process.env.WHATSAPP_GRAPH_BASE_URL,
  };
}

interface MetaSendResponse {
  messages?: { id: string }[];
  error?: { message: string; code: number; type?: string };
}

async function postToGraph(
  cfg: MetaConfig,
  body: Record<string, unknown>,
): Promise<SendResult> {
  const base = cfg.baseUrl ?? `https://graph.facebook.com/${GRAPH_VERSION}`;
  const url = `${base}/${cfg.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as MetaSendResponse;

  if (!res.ok || json.error) {
    throw new WhatsAppError(
      json.error?.message ?? `Meta send failed (${res.status})`,
      String(json.error?.code ?? res.status),
      res.status,
      json,
    );
  }

  const messageId = json.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppError("Meta returned no message id", "no_message_id", 502, json);
  }
  return { messageId, provider: "meta" };
}

export const metaProvider: WhatsAppProvider = {
  async sendText({ to, body, previewUrl }: SendTextOptions) {
    const cfg = readConfig();
    return postToGraph(cfg, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaRecipient(to),
      type: "text",
      text: { body, preview_url: previewUrl ?? false },
    });
  },

  async sendTemplate({
    to,
    templateName,
    languageCode,
    bodyVariables,
    buttonVariables,
  }: SendTemplateOptions) {
    const cfg = readConfig();
    const spec = getTemplate(templateName as Parameters<typeof getTemplate>[0]);
    const variableCount = bodyVariables?.length ?? 0;
    if (variableCount !== spec.variableCount) {
      throw new WhatsAppError(
        `Template ${templateName} expects ${spec.variableCount} variables, got ${variableCount}`,
        "template_variable_mismatch",
        400,
      );
    }

    const components: unknown[] = [];
    if (bodyVariables && bodyVariables.length > 0) {
      components.push({
        type: "body",
        parameters: bodyVariables.map((v) => ({ type: "text", text: v })),
      });
    }
    if (buttonVariables) {
      for (const b of buttonVariables) {
        // url buttons take a dynamic URL/path suffix as a "text" param.
        // quick_reply buttons carry a dynamic payload that comes back to us
        // as `interactive.button_reply.id` in the webhook.
        const param =
          b.subType === "quick_reply"
            ? { type: "payload", payload: b.value }
            : { type: "text", text: b.value };
        components.push({
          type: "button",
          sub_type: b.subType,
          index: b.index,
          parameters: [param],
        });
      }
    }

    return postToGraph(cfg, {
      messaging_product: "whatsapp",
      to: toMetaRecipient(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length ? { components } : {}),
      },
    });
  },
};
