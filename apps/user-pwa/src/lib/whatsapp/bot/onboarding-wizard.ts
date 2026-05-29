import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyTemplate, notifyText } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";
import type { Json } from "@/lib/supabase/types";
import { downloadMediaBytes } from "../client";
import type { InboundMedia } from "../types";
import {
  clearOnboardingState,
  getOnboardingState,
  setOnboardingState,
  type BookingBucket,
  type OnboardingState,
  type OnboardingStep,
} from "./onboarding-state";

/**
 * 12-step WhatsApp self-onboarding chatbot for new workshops, per the
 * Auto GTG MVP blueprint.
 *
 * Flow:
 *   WORKSHOP_NAME → OWNER_NAME → AREA → SERVICES (multi-select buckets)
 *   → RSA_YES_NO → (RSA_RADIUS if yes) → PICKUP → HOURS → WEEKLY_OFF
 *   → VERIFICATION_DOC (image or PDF) → PHONE_CONFIRM → SUBMITTED
 *
 * On submission we insert BOTH a `mechanics` row (onboarding_status=
 * 'self_signup') and a `garages` row (active=false, onboarding_status=
 * 'pending_verification'), linked by mechanic_id. Ops reviews + flips
 * active=true via the `/ops/garages` UI.
 *
 * Universal escapes: CANCEL/STOP clears the session. Step-level mistakes
 * re-prompt with the same options.
 *
 * The wizard never throws — failures become friendly replies + audit rows
 * so the webhook always returns 200 to Meta.
 */

export interface OnboardingResult {
  reply: string;
  /** Set when SUBMITTED — caller can use it for the audit trail. */
  garageId?: string;
}

const ENTRY_TRIGGERS = /^(onboard|register|partner|workshop signup)$/i;

export function isOnboardingEntry(text: string): boolean {
  return ENTRY_TRIGGERS.test(text.trim());
}

/** Main router. Returns reply text to send (empty = caller falls through). */
export async function handleOnboardingMessage(opts: {
  phone: string;
  text: string;
  media?: InboundMedia;
}): Promise<OnboardingResult> {
  const text = opts.text.trim();
  const lower = text.toLowerCase();

  if (lower === "cancel" || lower === "stop" || lower === "reset") {
    await clearOnboardingState(opts.phone);
    return {
      reply: "Onboarding cancelled. Reply ONBOARD anytime to start again.",
    };
  }

  // Entry — start fresh.
  if (isOnboardingEntry(text)) {
    const state: OnboardingState = {
      phone: opts.phone,
      step: "WORKSHOP_NAME",
      updatedAt: Date.now(),
    };
    await setOnboardingState(state);
    return { reply: prompts.workshopName() };
  }

  const state = await getOnboardingState(opts.phone);
  if (!state) return { reply: "" };

  switch (state.step) {
    case "WORKSHOP_NAME":
      return handleWorkshopName(state, text);
    case "OWNER_NAME":
      return handleOwnerName(state, text);
    case "AREA":
      return handleArea(state, text);
    case "SERVICES":
      return handleServices(state, lower);
    case "RSA_YES_NO":
      return handleRsaYesNo(state, lower);
    case "RSA_RADIUS":
      return handleRsaRadius(state, lower);
    case "PICKUP":
      return handlePickup(state, lower);
    case "HOURS":
      return handleHours(state, text);
    case "WEEKLY_OFF":
      return handleWeeklyOff(state, text);
    case "VERIFICATION_DOC":
      return handleVerificationDoc(state, opts.media, text);
    case "PHONE_CONFIRM":
      return handlePhoneConfirm(state, lower, text);
    case "SUBMITTED":
      // Shouldn't usually reach — state is cleared on submit. Defensive:
      await clearOnboardingState(state.phone);
      return {
        reply: "Your application is in. Reply ONBOARD to register another workshop.",
      };
  }
}

// ── Prompts ────────────────────────────────────────────────────────────────

const SERVICE_OPTIONS: { key: BookingBucket; label: string }[] = [
  { key: "scheduled_maintenance", label: "Scheduled Maintenance (oil, brakes, battery, tyres)" },
  { key: "rsa", label: "Roadside Assistance (puncture, jump-start, towing)" },
  { key: "detailing", label: "Detailing (wash, polish, ceramic)" },
  { key: "repairs", label: "Repairs (engine, AC, electricals)" },
  { key: "denting", label: "Denting & Painting" },
];

const RSA_RADIUS_OPTIONS = [5, 10, 20];

const prompts = {
  workshopName: () =>
    [
      "Hello 👋",
      "Welcome to Mistr Waan. We help workshops get more customers through our service network.",
      "",
      "Let's get you onboarded — takes ~5 minutes. Reply CANCEL anytime to stop.",
      "",
      "*Step 1 of 11:* What's your workshop / shop name?",
    ].join("\n"),

  ownerName: () => "*Step 2:* Owner name?",

  area: () =>
    [
      "*Step 3:* Which area is your workshop in?",
      "(e.g. Rajbagh, Hyderpora, Sanat Nagar, Bemina, Lal Chowk)",
    ].join("\n"),

  services: () =>
    [
      "*Step 4:* Which services do you provide? Reply with the numbers separated by commas (e.g. `1,3,4`).",
      "",
      ...SERVICE_OPTIONS.map((o, i) => `${i + 1}. ${o.label}`),
    ].join("\n"),

  rsaYesNo: () =>
    [
      "*Step 5:* Can you provide on-site Roadside Assistance (puncture, jump start, towing)?",
      "",
      "Reply YES or NO.",
    ].join("\n"),

  rsaRadius: () =>
    [
      "*Step 6:* How far will you travel for RSA?",
      "",
      ...RSA_RADIUS_OPTIONS.map((km, i) => `${i + 1}. ${km} km`),
    ].join("\n"),

  pickup: () =>
    [
      "*Step 7:* Can you provide vehicle pickup service?",
      "(Pickup-enabled garages get priority on higher-paying jobs.)",
      "",
      "Reply YES or NO.",
    ].join("\n"),

  hours: () =>
    [
      "*Step 8:* What are your working hours?",
      "(e.g. `9 AM – 8 PM`, `10:00–19:00`)",
    ].join("\n"),

  weeklyOff: () =>
    [
      "*Step 9:* Do you have a weekly off day?",
      "(e.g. `Friday`, `Sunday`, or `None`)",
    ].join("\n"),

  verificationDoc: () =>
    [
      "*Step 10:* Please send ONE verification document as a photo or PDF.",
      "",
      "Any of: Aadhaar Card · Driving License · Shop Registration · GST Certificate.",
      "",
      "Just attach the image / PDF and send it in this chat.",
    ].join("\n"),

  phoneConfirm: (defaultPhone: string) =>
    [
      `*Step 11:* Confirm your WhatsApp number for jobs: *${defaultPhone}*`,
      "",
      "Reply YES to confirm, or type a different number.",
    ].join("\n"),
};

// ── Step handlers ──────────────────────────────────────────────────────────

function trimmedOk(text: string, min = 2, max = 80): string | null {
  const t = text.trim();
  return t.length >= min && t.length <= max ? t : null;
}

async function handleWorkshopName(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const v = trimmedOk(text);
  if (!v) return { reply: `Please enter a workshop name (2-80 chars).\n\n${prompts.workshopName()}` };
  state.workshopName = v;
  state.step = "OWNER_NAME";
  await setOnboardingState(state);
  return { reply: prompts.ownerName() };
}

async function handleOwnerName(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const v = trimmedOk(text);
  if (!v) return { reply: `Please enter the owner's name.\n\n${prompts.ownerName()}` };
  state.ownerName = v;
  state.step = "AREA";
  await setOnboardingState(state);
  return { reply: prompts.area() };
}

async function handleArea(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const v = trimmedOk(text, 2, 60);
  if (!v) return { reply: `Please enter your area (2-60 chars).\n\n${prompts.area()}` };
  state.area = v;
  state.step = "SERVICES";
  await setOnboardingState(state);
  return { reply: prompts.services() };
}

async function handleServices(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const picked = parseMultiChoice(text, SERVICE_OPTIONS.length);
  if (picked.length === 0) {
    return {
      reply: `Reply with one or more numbers, comma-separated (e.g. 1,3).\n\n${prompts.services()}`,
    };
  }
  state.serviceBuckets = picked.map((i) => SERVICE_OPTIONS[i - 1]!.key);
  // If they picked RSA in services, ask RSA-specific questions next; else
  // we still ask RSA_YES_NO (some garages do RSA on the side without offering
  // it as a primary service).
  state.step = "RSA_YES_NO";
  await setOnboardingState(state);
  return { reply: prompts.rsaYesNo() };
}

async function handleRsaYesNo(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const yes = parseYesNo(text);
  if (yes == null) return { reply: `Reply YES or NO.\n\n${prompts.rsaYesNo()}` };
  state.rsaAvailable = yes;
  if (yes) {
    state.step = "RSA_RADIUS";
    await setOnboardingState(state);
    return { reply: prompts.rsaRadius() };
  }
  state.step = "PICKUP";
  await setOnboardingState(state);
  return { reply: prompts.pickup() };
}

async function handleRsaRadius(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const idx = parseChoice(text, RSA_RADIUS_OPTIONS.length);
  if (idx == null) return { reply: `Pick 1-${RSA_RADIUS_OPTIONS.length}.\n\n${prompts.rsaRadius()}` };
  state.rsaRadiusKm = RSA_RADIUS_OPTIONS[idx - 1];
  state.step = "PICKUP";
  await setOnboardingState(state);
  return { reply: prompts.pickup() };
}

async function handlePickup(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const yes = parseYesNo(text);
  if (yes == null) return { reply: `Reply YES or NO.\n\n${prompts.pickup()}` };
  state.pickupAvailable = yes;
  state.step = "HOURS";
  await setOnboardingState(state);
  return { reply: prompts.hours() };
}

async function handleHours(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const v = trimmedOk(text, 2, 40);
  if (!v) return { reply: `Please enter working hours.\n\n${prompts.hours()}` };
  state.workingHours = v;
  state.step = "WEEKLY_OFF";
  await setOnboardingState(state);
  return { reply: prompts.weeklyOff() };
}

async function handleWeeklyOff(
  state: OnboardingState,
  text: string,
): Promise<OnboardingResult> {
  const v = trimmedOk(text, 2, 40);
  if (!v) return { reply: `Please enter your weekly off (or "None").\n\n${prompts.weeklyOff()}` };
  state.weeklyOff = v;
  state.step = "VERIFICATION_DOC";
  await setOnboardingState(state);
  return { reply: prompts.verificationDoc() };
}

async function handleVerificationDoc(
  state: OnboardingState,
  media: InboundMedia | undefined,
  text: string,
): Promise<OnboardingResult> {
  if (!media) {
    if (text.length > 0) {
      return {
        reply:
          "Please send the document as a photo or PDF attachment, not as text.\n\n" +
          prompts.verificationDoc(),
      };
    }
    return { reply: prompts.verificationDoc() };
  }
  try {
    const { bytes, mimeType } = await downloadMediaBytes(media.id);
    const supabase = getSupabaseAdmin();
    const ext = mimeToExt(media.mimeType || mimeType);
    const path = `pending/${randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("verification-docs")
      .upload(path, bytes, {
        contentType: media.mimeType || mimeType,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadErr) throw new Error(`upload failed: ${uploadErr.message}`);
    state.verificationDocPath = path;
    state.step = "PHONE_CONFIRM";
    await setOnboardingState(state);
    return { reply: prompts.phoneConfirm(state.phone) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "onboarding_doc_upload",
      entityType: "garage_onboarding",
      entityId: state.phone,
      actor: state.phone,
      outcome: "error",
      error: message,
    });
    return {
      reply:
        "Sorry, that document didn't go through. Please try sending it again.",
    };
  }
}

async function handlePhoneConfirm(
  state: OnboardingState,
  lower: string,
  text: string,
): Promise<OnboardingResult> {
  let confirmed: string;
  if (lower === "yes" || lower === "y" || lower === "confirm" || lower === "ok") {
    confirmed = state.phone;
  } else {
    // Treat as phone input. Accept Indian mobile in various formats.
    const digits = text.replace(/\D+/g, "");
    if (digits.length < 10 || digits.length > 13) {
      return {
        reply: `That doesn't look like a phone number. Reply YES to use ${state.phone}, or type a 10-digit Indian mobile.`,
      };
    }
    // Normalize to +91 prefix if missing.
    confirmed = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }
  state.phoneConfirmed = confirmed;
  state.step = "SUBMITTED";
  await setOnboardingState(state);
  return submitOnboarding(state);
}

// ── Submit ─────────────────────────────────────────────────────────────────

async function submitOnboarding(state: OnboardingState): Promise<OnboardingResult> {
  // Validate everything is present (defensive — should be guaranteed by the
  // state machine but JSON could be corrupted).
  if (
    !state.workshopName ||
    !state.ownerName ||
    !state.area ||
    !state.serviceBuckets ||
    state.serviceBuckets.length === 0 ||
    state.pickupAvailable == null ||
    state.rsaAvailable == null ||
    !state.workingHours ||
    !state.weeklyOff ||
    !state.verificationDocPath ||
    !state.phoneConfirmed
  ) {
    await clearOnboardingState(state.phone);
    return {
      reply:
        "Something went wrong with your application. Please reply ONBOARD to start again.",
    };
  }

  const supabase = getSupabaseAdmin();
  const mechanicId = randomUUID();
  const ownerParts = state.ownerName.split(/\s+/);
  const ownerFirstName = ownerParts[0]!;
  const ownerLastName = ownerParts.slice(1).join(" ") || "-";

  // 1. mechanics row (pipeline tracking).
  const { error: mechErr } = await supabase.from("mechanics").insert({
    id: mechanicId,
    name: state.workshopName,
    shop_name: state.workshopName,
    phones: [state.phoneConfirmed],
    area: state.area,
    services: state.serviceBuckets,
    onboarding_status: "self_signup",
    business_profile: {
      ownerName: state.ownerName,
      ownerRole: "owner",
      workingHours: state.workingHours,
      weeklyOff: state.weeklyOff,
      rsaAvailable: state.rsaAvailable,
      rsaRadiusKm: state.rsaRadiusKm,
      pickupAvailable: state.pickupAvailable,
      verificationDocPath: state.verificationDocPath,
      source: "whatsapp_chatbot",
    } as Json,
    source: "whatsapp_chatbot",
  });
  if (mechErr) {
    await failSubmit(state, `mechanic insert failed: ${mechErr.message}`);
    return {
      reply:
        "Sorry, we couldn't save your application right now. Please try again in a few minutes.",
    };
  }

  // 2. garages row (the active partner record, pending verification).
  const { data: garage, error: garageErr } = await supabase
    .from("garages")
    .insert({
      mechanic_id: mechanicId,
      shop_name: state.workshopName,
      owner_first_name: ownerFirstName,
      owner_last_name: ownerLastName,
      phone: state.phoneConfirmed,
      whatsapp_phone: state.phone,
      area: state.area,
      full_address: state.area, // we don't ask for full address; ops can edit
      service_buckets: state.serviceBuckets,
      working_hours: state.workingHours,
      weekly_off: state.weeklyOff,
      rsa_available: state.rsaAvailable,
      rsa_radius_km: state.rsaRadiusKm,
      pickup_available: state.pickupAvailable,
      verification_doc_path: state.verificationDocPath,
      active: false,
      onboarding_status: "pending_verification",
    })
    .select("id")
    .single();
  if (garageErr || !garage) {
    await failSubmit(state, `garage insert failed: ${garageErr?.message ?? "no row"}`);
    return {
      reply:
        "Sorry, we couldn't save your application right now. Please try again in a few minutes.",
    };
  }

  await appendAuditEntry({
    action: "mechanic_self_signup",
    entityType: "garage",
    entityId: garage.id,
    actor: state.phone,
    payload: {
      mechanicId,
      workshopName: state.workshopName,
      area: state.area,
      serviceBuckets: state.serviceBuckets,
      rsaAvailable: state.rsaAvailable,
      pickupAvailable: state.pickupAvailable,
    },
    outcome: "success",
  });

  // 3. Send confirmation template to the mechanic.
  await notifyTemplate({
    to: state.phone,
    template: "mechanic_onboarding_submitted",
    variables: [ownerFirstName, state.workshopName],
  });

  // 4. Best-effort alert to ops admin (env-gated; silent if unset).
  const opsAdminPhone = process.env.OPS_ADMIN_PHONE;
  if (opsAdminPhone) {
    await notifyText({
      to: opsAdminPhone,
      body: `New workshop pending: ${state.workshopName} (${state.area}). Garage id: ${garage.id}`,
    }).catch(() => undefined);
  }

  await clearOnboardingState(state.phone);
  return {
    reply: [
      "🎉 Thanks! Your application is submitted.",
      "",
      "Our team will review your details and activate your partner profile within 24 hours. We'll WhatsApp you once you're live.",
      "",
      "Have a question? Reply HELP.",
    ].join("\n"),
    garageId: garage.id,
  };
}

async function failSubmit(state: OnboardingState, error: string): Promise<void> {
  await appendAuditEntry({
    action: "mechanic_self_signup",
    entityType: "garage_onboarding",
    entityId: state.phone,
    actor: state.phone,
    payload: { workshopName: state.workshopName, area: state.area },
    outcome: "error",
    error,
  });
  // Don't clear state — let them retry phone confirm without redoing everything.
  state.step = "PHONE_CONFIRM";
  await setOnboardingState(state);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseChoice(text: string, max: number): number | null {
  const digits = text.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return n;
}

/** Parse "1,3,5" or "1 3 5" etc into 1-based unique indices, capped at `max`. */
function parseMultiChoice(text: string, max: number): number[] {
  const set = new Set<number>();
  for (const part of text.split(/[\s,]+/)) {
    const n = parseInt(part.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n) && n >= 1 && n <= max) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function parseYesNo(text: string): boolean | null {
  if (text === "yes" || text === "y" || text === "1") return true;
  if (text === "no" || text === "n" || text === "2") return false;
  return null;
}

function mimeToExt(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

// Re-export for the intent router so it doesn't import the state module too.
export { getOnboardingState };

// Re-export the step type alias for tests.
export type { OnboardingStep };
