/**
 * Provider-agnostic WhatsApp types. Today only Meta Cloud API is wired,
 * but the shape leaves room for AiSensy/Gupshup later without UI changes.
 */

export interface SendTextOptions {
  to: string;
  body: string;
  previewUrl?: boolean;
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode: string;
  bodyVariables?: string[];
  buttonVariables?: { subType: "url" | "quick_reply"; index: number; value: string }[];
}

export interface SendResult {
  messageId: string;
  provider: "meta" | "aisensy" | "gupshup";
}

export interface WhatsAppProvider {
  sendText(opts: SendTextOptions): Promise<SendResult>;
  sendTemplate(opts: SendTemplateOptions): Promise<SendResult>;
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly providerResponse?: unknown,
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

export interface InboundMedia {
  /** Meta media id — exchange for a temporary download URL via GET /{id}. */
  id: string;
  mimeType: string;
  caption?: string;
  /** sha256 hash Meta provides — useful for de-dup if a customer resends. */
  sha256?: string;
}

export interface InboundMessage {
  from: string;
  messageId: string;
  timestamp: string;
  type: "text" | "interactive" | "button" | "location" | "image" | "audio" | "other";
  text?: string;
  interactiveId?: string;
  /** Populated for image / audio / document messages. */
  media?: InboundMedia;
  raw: unknown;
}
