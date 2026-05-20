import { NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { parseInboundMessages } from "@/lib/whatsapp/client";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

/**
 * Meta WhatsApp webhook.
 *
 * GET  — one-time subscription verification: echo `hub.challenge` when the
 *        `hub.verify_token` matches our configured token.
 * POST — inbound messages and delivery-status callbacks. Signature MUST be
 *        verified against the app secret. We currently log + audit only; the
 *        full bot intent router (Packet B6) will replace the stub below.
 *
 * Must return 200 quickly — Meta retries on >5s or non-2xx.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    await appendAuditEntry({
      action: "whatsapp_webhook_rejected",
      entityType: "whatsapp_webhook",
      entityId: "unknown",
      actor: "meta",
      outcome: "error",
      error: "invalid_signature",
    });
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const inbound = parseInboundMessages(payload);
  for (const msg of inbound) {
    await appendAuditEntry({
      action: "whatsapp_inbound",
      entityType: "whatsapp_message",
      entityId: msg.messageId,
      actor: msg.from,
      payload: { type: msg.type, text: msg.text, interactiveId: msg.interactiveId },
      outcome: "success",
    });
    // TODO Packet B6 — route to intent handler (start/help/book/track/cancel/rate)
  }

  return NextResponse.json({ ok: true });
}
