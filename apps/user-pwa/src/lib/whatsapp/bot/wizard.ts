import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { upsertProfileByPhone } from "@/lib/auth/profile";
import { createBooking } from "@/lib/bookings/data";
import { appendAuditEntry } from "@/lib/audit/log";
import {
  clearWizardState,
  getWizardState,
  setWizardState,
  type WizardState,
} from "./state";

/**
 * Conversational booking wizard for the customer WhatsApp bot.
 *
 * Flow:
 *   PICKING_BUCKET   — detailing / repairs / denting
 *     → detailing → PICKING_SERVICE   (pick a specific catalog item)
 *     → repairs / denting → PICKING_DESCRIPTION (free-text problem)
 *   → PICKING_SLOT     — 4 quick options
 *   → PICKING_PAYMENT  — cash now (or UPI when Razorpay's enabled)
 *   → CONFIRMING       — show summary, expect CONFIRM/CANCEL
 *   → DONE             — create booking + clear state + reply with shortId
 *
 * Universal escapes (any state): CANCEL/STOP/RESET clears the session,
 * BOOK/START starts a fresh one. Step-level mistakes re-prompt.
 *
 * The wizard never throws — all errors are caught + reported as a friendly
 * reply, so the webhook always returns 200 to Meta.
 */

export interface WizardResult {
  /** Reply to send back. Empty string = "not in wizard, caller should fall through". */
  reply: string;
  done?: { bookingShortId: string };
}

export async function handleWizardMessage(opts: {
  phone: string;
  text: string;
}): Promise<WizardResult> {
  const text = opts.text.trim();
  const lower = text.toLowerCase();

  if (lower === "cancel" || lower === "stop" || lower === "reset") {
    await clearWizardState(opts.phone);
    return { reply: "Booking cancelled. Reply BOOK to start over." };
  }

  // BOOK / START — always restart fresh, even if a session is in flight.
  if (lower === "book" || lower === "start" || lower === "new booking") {
    const state: WizardState = {
      phone: opts.phone,
      step: "PICKING_BUCKET",
      updatedAt: Date.now(),
    };
    await setWizardState(state);
    return { reply: bucketPrompt() };
  }

  const state = await getWizardState(opts.phone);
  if (!state) {
    // Not in wizard, not a wizard entry — caller falls through.
    return { reply: "" };
  }

  switch (state.step) {
    case "PICKING_BUCKET":
      return handleBucketPick(state, lower);
    case "PICKING_SERVICE":
      return handleServicePick(state, lower);
    case "PICKING_DESCRIPTION":
      return handleDescription(state, text);
    case "PICKING_SLOT":
      return handleSlotPick(state, lower);
    case "PICKING_PAYMENT":
      return handlePaymentPick(state, lower);
    case "CONFIRMING":
      return handleConfirm(state, lower);
  }
}

const BUCKETS = ["detailing", "repairs", "denting"] as const;

function bucketPrompt(): string {
  return [
    "Hi! 👋 I'm Mistr Waan. What service do you need?",
    "",
    "1️⃣ Detailing (wash, polish, ceramic)",
    "2️⃣ Repairs (engine, brakes, AC)",
    "3️⃣ Denting & painting",
    "",
    "Reply with 1, 2, or 3.",
    "(Reply CANCEL anytime to stop.)",
  ].join("\n");
}

async function handleBucketPick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const idx = parseChoice(text, 3);
  if (idx == null) {
    return { reply: "Please reply with 1, 2, or 3.\n\n" + bucketPrompt() };
  }
  const bucket = BUCKETS[idx - 1]!;
  state.bucket = bucket;

  if (bucket === "detailing") {
    state.step = "PICKING_SERVICE";
    await setWizardState(state);
    return { reply: await servicePrompt(bucket) };
  } else {
    state.step = "PICKING_DESCRIPTION";
    await setWizardState(state);
    return {
      reply: [
        bucket === "repairs" ? "Repairs 🛠️" : "Denting & painting 🎨",
        "",
        "Describe what's wrong in 1-2 lines so our team can quote accurately.",
        bucket === "repairs"
          ? '(e.g. "brakes squeak when stopping", "AC not cooling")'
          : '(e.g. "left bumper dent from parking", "scratch on rear door")',
      ].join("\n"),
    };
  }
}

interface ServiceLite {
  id: string;
  name: string;
  basePrice: number;
  isQuoted: boolean;
}

async function fetchServices(
  bucket: "detailing" | "repairs" | "denting",
): Promise<ServiceLite[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("services")
    .select("id, name, base_price, is_quoted")
    .eq("bucket", bucket)
    .eq("active", true)
    .order("display_order");
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    basePrice: s.base_price,
    isQuoted: s.is_quoted,
  }));
}

async function servicePrompt(bucket: "detailing"): Promise<string> {
  const services = await fetchServices(bucket);
  const lines = [
    "Detailing services:",
    "",
    ...services.map(
      (s, i) =>
        `${i + 1}. ${s.name} — ${s.isQuoted ? "On quote" : `₹${s.basePrice}`}`,
    ),
    "",
    "Reply with the number, or BACK to change category.",
  ];
  return lines.join("\n");
}

async function handleServicePick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  if (text === "back") {
    state.step = "PICKING_BUCKET";
    state.bucket = undefined;
    await setWizardState(state);
    return { reply: bucketPrompt() };
  }
  const services = await fetchServices("detailing");
  const idx = parseChoice(text, services.length);
  if (idx == null) {
    return {
      reply:
        `Please reply with a number between 1 and ${services.length}, or BACK.\n\n` +
        (await servicePrompt("detailing")),
    };
  }
  const picked = services[idx - 1]!;
  state.serviceIds = [picked.id];
  state.serviceNames = [picked.name];
  state.step = "PICKING_SLOT";
  await setWizardState(state);
  return { reply: slotPrompt() };
}

async function handleDescription(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  if (text.length < 5 || text.length > 500) {
    return {
      reply: "Give a short description (between 5 and 500 characters).",
    };
  }
  state.description = text;
  state.step = "PICKING_SLOT";
  await setWizardState(state);
  return { reply: slotPrompt() };
}

interface SlotOption {
  label: string;
  date: string; // YYYY-MM-DD (IST)
  time: string; // HH:MM (24h, IST)
}

function getSlotOptions(now: Date = new Date()): SlotOption[] {
  // Use IST-relative dates. Node's toISOString gives UTC; subtract +5:30 worth
  // of work by computing a local-IST date string.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const fmt = (d: Date) => {
    const ist = new Date(d.getTime() + istOffsetMs);
    return ist.toISOString().slice(0, 10);
  };
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const saturday = new Date(now);
  // 6 = Saturday in JS; if today is Saturday, jump to next Saturday.
  const daysUntilSat = ((6 - today.getDay() + 7) % 7) || 7;
  saturday.setDate(today.getDate() + daysUntilSat);

  return [
    { label: "Today afternoon (3 PM)", date: fmt(today), time: "15:00" },
    { label: "Tomorrow morning (10 AM)", date: fmt(tomorrow), time: "10:00" },
    { label: "Tomorrow afternoon (3 PM)", date: fmt(tomorrow), time: "15:00" },
    { label: "This weekend (Sat 11 AM)", date: fmt(saturday), time: "11:00" },
  ];
}

function slotPrompt(): string {
  const options = getSlotOptions();
  return [
    "When works for you?",
    "",
    ...options.map((o, i) => `${i + 1}. ${o.label}`),
    "",
    "Reply with 1-4. Our team confirms the exact time when they call.",
  ].join("\n");
}

async function handleSlotPick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const options = getSlotOptions();
  const idx = parseChoice(text, options.length);
  if (idx == null) {
    return {
      reply:
        `Please reply with a number between 1 and ${options.length}.\n\n` +
        slotPrompt(),
    };
  }
  const slot = options[idx - 1]!;
  state.slotLabel = slot.label;
  state.slotDate = slot.date;
  state.slotTime = slot.time;
  state.step = "PICKING_PAYMENT";
  await setWizardState(state);
  return { reply: paymentPrompt() };
}

function paymentPrompt(): string {
  const upiEnabled = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";
  const lines = ["How would you like to pay?", "", "1. Cash on visit"];
  if (upiEnabled) {
    lines.push("2. UPI online (after we quote)");
  }
  lines.push("", `Reply with ${upiEnabled ? "1 or 2" : "1"}.`);
  return lines.join("\n");
}

async function handlePaymentPick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const upiEnabled = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";
  const max = upiEnabled ? 2 : 1;
  const idx = parseChoice(text, max);
  if (idx == null) {
    return { reply: `Please reply with a number.\n\n${paymentPrompt()}` };
  }
  state.paymentMode = idx === 1 ? "cash" : "upi";
  state.step = "CONFIRMING";
  await setWizardState(state);
  return { reply: confirmPrompt(state) };
}

function confirmPrompt(state: WizardState): string {
  const lines = [
    "📋 Booking summary:",
    "",
    `• Service: ${state.serviceNames?.join(", ") ?? state.bucket}`,
  ];
  if (state.description) lines.push(`• What's wrong: ${state.description}`);
  lines.push(`• Slot: ${state.slotLabel}`);
  lines.push(
    `• Payment: ${state.paymentMode === "cash" ? "Cash on visit" : "UPI online"}`,
  );
  lines.push("");
  lines.push("Reply CONFIRM to book, or CANCEL to start over.");
  return lines.join("\n");
}

async function handleConfirm(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  if (text !== "confirm" && text !== "yes" && text !== "y" && text !== "ok") {
    return {
      reply: "Please reply CONFIRM to book or CANCEL to start over.",
    };
  }
  if (!state.bucket || !state.slotLabel || !state.paymentMode) {
    await clearWizardState(state.phone);
    return {
      reply:
        "Something went wrong with your booking session. Please reply BOOK to start again.",
    };
  }
  try {
    const profile = await upsertProfileByPhone(state.phone);
    const symptoms: Record<string, unknown> | null =
      state.bucket === "repairs" && state.description
        ? { description: state.description, source: "whatsapp_bot" }
        : null;
    const denting: Record<string, unknown> | null =
      state.bucket === "denting" && state.description
        ? { description: state.description, source: "whatsapp_bot" }
        : null;
    const booking = await createBooking({
      profileId: profile.id,
      bucket: state.bucket,
      serviceIds: state.serviceIds ?? [],
      garageId: null,
      slotLabel: state.slotLabel,
      slotDate: state.slotDate ?? null,
      slotTime: state.slotTime ?? null,
      paymentMode: state.paymentMode,
      symptoms,
      denting,
    });
    await appendAuditEntry({
      action: "create_booking",
      entityType: "booking",
      entityId: booking.id,
      actor: profile.id,
      payload: {
        source: "whatsapp_bot",
        shortId: booking.shortId,
        bucket: booking.bucket,
        serviceIds: booking.serviceIds,
      },
      outcome: "success",
    });
    await clearWizardState(state.phone);
    return {
      reply: [
        `🎉 Booking confirmed: *${booking.shortId}*`,
        "",
        "Our team will call you in a few minutes to confirm details and the exact quote.",
        "",
        `Track anytime at autogtg.com/bookings/${booking.shortId}`,
      ].join("\n"),
      done: { bookingShortId: booking.shortId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "create_booking",
      entityType: "booking",
      entityId: "wizard",
      actor: state.phone,
      payload: { source: "whatsapp_bot", state: { ...state, phone: undefined } },
      outcome: "error",
      error: message,
    });
    await clearWizardState(state.phone);
    return {
      reply:
        "Sorry — we couldn't create your booking. Please try again from autogtg.com or reply HELP.",
    };
  }
}

/** Parse "1" / "1." / "1)" / etc into a 1-based choice index; null if invalid. */
function parseChoice(text: string, max: number): number | null {
  const digits = text.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return n;
}
