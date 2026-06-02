/**
 * Registry of pre-approved Meta WhatsApp templates.
 *
 * Each entry must exist in Meta Business Manager → WhatsApp Manager → Message Templates
 * in the matching language. The `name` here is the exact template name in Meta.
 * `variableCount` is enforced at send time so we never send a malformed template.
 *
 * For templates with quick-reply buttons (e.g. `garage_new_job`), `buttonCount`
 * is set so the send path validates we passed the right number of payloads.
 * Buttons without dynamic payloads (static quick replies, URL buttons) don't
 * need a count; they're configured entirely inside Meta's template builder.
 */

export type TemplateName =
  | "otp_login"
  | "booking_confirmed"
  | "booking_quoted"
  | "garage_new_job"
  | "mechanic_assigned"
  | "garage_declined"
  | "job_started"
  | "job_complete"
  | "booking_cancelled"
  | "referral_reward"
  // Phase 5 — blueprint alignment
  | "mechanic_onboarding_submitted"
  | "mechanic_activated"
  | "mechanic_rejected"
  | "request_photos"
  | "rsa_acknowledged";

export interface TemplateSpec {
  name: TemplateName;
  language: string;
  variableCount: number;
  /** Number of dynamic quick-reply payloads expected. 0 means no payload-carrying buttons. */
  buttonCount?: number;
  category: "authentication" | "utility" | "marketing";
}

export const TEMPLATES: Record<TemplateName, TemplateSpec> = {
  otp_login: {
    name: "otp_login",
    language: "en",
    variableCount: 1,
    category: "authentication",
  },
  booking_confirmed: {
    name: "booking_confirmed",
    language: "en",
    variableCount: 3,
    category: "utility",
  },
  booking_quoted: {
    name: "booking_quoted",
    language: "en",
    variableCount: 3, // shortId, amount, paymentMode
    category: "utility",
  },
  garage_new_job: {
    name: "garage_new_job",
    language: "en",
    variableCount: 4, // shopName, customer, service, slot
    buttonCount: 2, // accept, decline
    category: "utility",
  },
  mechanic_assigned: {
    name: "mechanic_assigned",
    language: "en",
    variableCount: 2,
    category: "utility",
  },
  garage_declined: {
    name: "garage_declined",
    language: "en",
    variableCount: 2,
    category: "utility",
  },
  job_started: {
    name: "job_started",
    language: "en",
    variableCount: 2,
    category: "utility",
  },
  job_complete: {
    name: "job_complete",
    language: "en",
    variableCount: 1,
    category: "utility",
  },
  booking_cancelled: {
    name: "booking_cancelled",
    language: "en",
    variableCount: 2,
    category: "utility",
  },
  referral_reward: {
    name: "referral_reward",
    language: "en",
    variableCount: 2,
    category: "marketing",
  },
  // ── Phase 5: blueprint alignment ─────────────────────────────────────────
  mechanic_onboarding_submitted: {
    name: "mechanic_onboarding_submitted",
    language: "en",
    variableCount: 2, // ownerFirstName, shopName
    category: "utility",
  },
  mechanic_activated: {
    name: "mechanic_activated",
    language: "en",
    variableCount: 2, // ownerFirstName, shopName
    category: "utility",
  },
  mechanic_rejected: {
    name: "mechanic_rejected",
    language: "en",
    variableCount: 2, // ownerFirstName, reason
    category: "utility",
  },
  request_photos: {
    name: "request_photos",
    language: "en",
    variableCount: 2, // customerFirstName, shortId
    category: "utility",
  },
  rsa_acknowledged: {
    name: "rsa_acknowledged",
    language: "en",
    variableCount: 2, // customerFirstName, shortId
    category: "utility",
  },
};

export function getTemplate(name: TemplateName): TemplateSpec {
  return TEMPLATES[name];
}
