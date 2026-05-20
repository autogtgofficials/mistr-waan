/**
 * Registry of pre-approved Meta WhatsApp templates.
 *
 * Each entry must exist in Meta Business Manager → WhatsApp Manager → Message Templates
 * in the matching language. The `name` here is the exact template name in Meta.
 * `variableCount` is enforced at send time so we never send a malformed template.
 */

export type TemplateName = "otp_login" | "booking_confirmed" | "mechanic_assigned" | "job_complete";

export interface TemplateSpec {
  name: TemplateName;
  language: string;
  variableCount: number;
  category: "authentication" | "utility" | "marketing";
}

export const TEMPLATES: Record<TemplateName, TemplateSpec> = {
  otp_login: { name: "otp_login", language: "en", variableCount: 1, category: "authentication" },
  booking_confirmed: {
    name: "booking_confirmed",
    language: "en",
    variableCount: 3,
    category: "utility",
  },
  mechanic_assigned: {
    name: "mechanic_assigned",
    language: "en",
    variableCount: 2,
    category: "utility",
  },
  job_complete: { name: "job_complete", language: "en", variableCount: 1, category: "utility" },
};

export function getTemplate(name: TemplateName): TemplateSpec {
  return TEMPLATES[name];
}
