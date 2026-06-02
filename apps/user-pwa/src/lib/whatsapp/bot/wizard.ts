import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { upsertProfileByPhone } from "@/lib/auth/profile";
import { createBooking } from "@/lib/bookings/data";
import { appendAuditEntry } from "@/lib/audit/log";
import { notifyTemplate } from "@/lib/notifications/outbox";
import {
  listActiveAreas,
  listGaragesByAreaAndBucket,
  type Garage,
} from "@/lib/garage/data";
import {
  clearWizardState,
  getWizardState,
  setWizardState,
  type CustomerModule,
  type ServiceBucket,
  type VehicleType,
  type WizardState,
} from "./state";

/**
 * Conversational booking wizard for the customer WhatsApp bot. Aligned with
 * the Auto GTG MVP blueprint as of Phase 5:
 *
 *   PICKING_MODULE       — 1.Maintenance 2.RSA 3.Additional
 *   → PICKING_VEHICLE_TYPE — 1.Car 2.Bike  (skipped for Additional → handled
 *                            on a per-bucket basis since detailing applies
 *                            to cars; bike-detailing isn't a thing in V1)
 *     → PICKING_BUCKET   — Additional only (detailing/repairs/denting)
 *       → PICKING_SERVICE / PICKING_DESCRIPTION  (per bucket)
 *         → PICKING_AREA       — numbered list from active garages
 *           → PICKING_GARAGE   — numbered list of garages in area + bucket
 *             → PICKING_SLOT   — 4 quick options (skipped for RSA — urgent)
 *               → PICKING_VEHICLE_DETAILS — brand + model + optional reg
 *                 → PICKING_PAYMENT — cash (or UPI when Razorpay flag on)
 *                   → CONFIRMING — summary, expect CONFIRM
 *                     → DONE — creates booking + clears state
 *
 * Universal escapes (any state): CANCEL/STOP/RESET clears the session.
 * BOOK/START restarts fresh. Step-level mistakes re-prompt.
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
      step: "PICKING_MODULE",
      updatedAt: Date.now(),
    };
    await setWizardState(state);
    return { reply: modulePrompt() };
  }

  const state = await getWizardState(opts.phone);
  if (!state) {
    return { reply: "" };
  }

  switch (state.step) {
    case "PICKING_MODULE":
      return handleModulePick(state, lower);
    case "PICKING_VEHICLE_TYPE":
      return handleVehicleTypePick(state, lower);
    case "PICKING_BUCKET":
      return handleBucketPick(state, lower);
    case "PICKING_SERVICE":
      return handleServicePick(state, lower);
    case "PICKING_DESCRIPTION":
      return handleDescription(state, text);
    case "PICKING_AREA":
      return handleAreaPick(state, lower);
    case "PICKING_GARAGE":
      return handleGaragePick(state, lower);
    case "PICKING_SLOT":
      return handleSlotPick(state, lower);
    case "PICKING_VEHICLE_DETAILS":
      return handleVehicleDetails(state, text);
    case "PICKING_PAYMENT":
      return handlePaymentPick(state, lower);
    case "CONFIRMING":
      return handleConfirm(state, lower);
  }
}

// ── Step 1: module ─────────────────────────────────────────────────────────

const MODULES: { key: CustomerModule; label: string; emoji: string }[] = [
  { key: "maintenance", label: "Scheduled Maintenance (oil, brakes, battery, tyres)", emoji: "🔧" },
  { key: "rsa", label: "Roadside Assistance (puncture, jump-start, towing)", emoji: "🚨" },
  { key: "additional", label: "Additional services (detailing, repairs, denting)", emoji: "✨" },
];

function modulePrompt(): string {
  return [
    "Hi! 👋 I'm AutoGTG. What do you need today?",
    "",
    ...MODULES.map((m, i) => `${i + 1}. ${m.emoji} ${m.label}`),
    "",
    "Reply with 1, 2, or 3. (CANCEL anytime to stop.)",
  ].join("\n");
}

async function handleModulePick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const idx = parseChoice(text, MODULES.length);
  if (idx == null) {
    return { reply: "Please reply with 1, 2, or 3.\n\n" + modulePrompt() };
  }
  const module = MODULES[idx - 1]!.key;
  state.module = module;
  // For Maintenance and RSA → ask vehicle type next.
  // For Additional → skip to bucket pick (detailing/repairs/denting all are car-only V1).
  if (module === "additional") {
    state.step = "PICKING_BUCKET";
    await setWizardState(state);
    return { reply: bucketPrompt() };
  }
  state.step = "PICKING_VEHICLE_TYPE";
  await setWizardState(state);
  return { reply: vehicleTypePrompt() };
}

// ── Step 2: vehicle type (for Maintenance + RSA) ───────────────────────────

const VEHICLE_TYPES: { key: VehicleType; label: string }[] = [
  { key: "car", label: "Car" },
  { key: "bike", label: "Bike / Two-wheeler" },
];

function vehicleTypePrompt(): string {
  return [
    "What vehicle?",
    "",
    ...VEHICLE_TYPES.map((v, i) => `${i + 1}. ${v.label}`),
    "",
    "Reply with 1 or 2.",
  ].join("\n");
}

async function handleVehicleTypePick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const idx = parseChoice(text, VEHICLE_TYPES.length);
  if (idx == null) {
    return { reply: "Please reply with 1 or 2.\n\n" + vehicleTypePrompt() };
  }
  state.vehicleType = VEHICLE_TYPES[idx - 1]!.key;
  // Module → bucket mapping.
  if (state.module === "maintenance") {
    state.bucket = "scheduled_maintenance";
    state.step = "PICKING_SERVICE";
    await setWizardState(state);
    return { reply: await maintenanceServicePrompt(state.vehicleType) };
  }
  if (state.module === "rsa") {
    state.bucket = "rsa";
    state.step = "PICKING_SERVICE";
    await setWizardState(state);
    return { reply: await rsaServicePrompt() };
  }
  // Defensive: shouldn't reach here
  state.step = "PICKING_BUCKET";
  await setWizardState(state);
  return { reply: bucketPrompt() };
}

// ── Step 3: bucket (Additional only) ───────────────────────────────────────

const ADDITIONAL_BUCKETS: { key: ServiceBucket; label: string }[] = [
  { key: "detailing", label: "Detailing (wash, polish, ceramic)" },
  { key: "repairs", label: "Repairs (engine, AC, electricals)" },
  { key: "denting", label: "Denting & painting" },
];

function bucketPrompt(): string {
  return [
    "Which additional service?",
    "",
    ...ADDITIONAL_BUCKETS.map((b, i) => `${i + 1}. ${b.label}`),
    "",
    "Reply 1-3, or BACK to change category.",
  ].join("\n");
}

async function handleBucketPick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  if (text === "back") {
    state.step = "PICKING_MODULE";
    state.module = undefined;
    await setWizardState(state);
    return { reply: modulePrompt() };
  }
  const idx = parseChoice(text, ADDITIONAL_BUCKETS.length);
  if (idx == null) {
    return { reply: "Please reply with 1, 2, or 3.\n\n" + bucketPrompt() };
  }
  const bucket = ADDITIONAL_BUCKETS[idx - 1]!.key;
  state.bucket = bucket;
  // Detailing applies to cars (V1) — assume car if vehicleType wasn't asked.
  if (!state.vehicleType) state.vehicleType = "car";

  if (bucket === "detailing") {
    state.step = "PICKING_SERVICE";
    await setWizardState(state);
    return { reply: await detailingServicePrompt() };
  }
  // repairs / denting → free-text description
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

// ── Step 4a: service pick (Maintenance, Detailing, RSA) ────────────────────

interface ServiceLite {
  id: string;
  name: string;
  basePrice: number;
  isQuoted: boolean;
}

async function fetchServices(bucket: ServiceBucket): Promise<ServiceLite[]> {
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

async function detailingServicePrompt(): Promise<string> {
  const services = await fetchServices("detailing");
  return [
    "Detailing services:",
    "",
    ...services.map(
      (s, i) =>
        `${i + 1}. ${s.name} — ${s.isQuoted ? "On quote" : `₹${s.basePrice}`}`,
    ),
    "",
    "Reply with the number, or BACK.",
  ].join("\n");
}

async function maintenanceServicePrompt(vehicleType: VehicleType): Promise<string> {
  const services = await fetchServices("scheduled_maintenance");
  const prefix = vehicleType === "car" ? "Car: " : "Bike: ";
  const filtered = services.filter((s) => s.name.startsWith(prefix));
  return [
    `${vehicleType === "car" ? "Car" : "Bike"} maintenance services:`,
    "",
    ...filtered.map(
      (s, i) =>
        `${i + 1}. ${s.name.replace(prefix, "")} — ${
          s.isQuoted ? "On quote" : `₹${s.basePrice}`
        }`,
    ),
    "",
    "Reply with the number, or BACK.",
  ].join("\n");
}

async function rsaServicePrompt(): Promise<string> {
  const services = await fetchServices("rsa");
  return [
    "🚨 What's the emergency?",
    "",
    ...services.map(
      (s, i) =>
        `${i + 1}. ${s.name}${s.isQuoted ? "" : ` — ₹${s.basePrice}`}`,
    ),
    "",
    "Reply with the number.",
  ].join("\n");
}

/** Services that the current state.bucket + vehicleType should display. */
async function currentServiceList(state: WizardState): Promise<ServiceLite[]> {
  if (state.bucket === "scheduled_maintenance" && state.vehicleType) {
    const all = await fetchServices("scheduled_maintenance");
    const prefix = state.vehicleType === "car" ? "Car: " : "Bike: ";
    return all.filter((s) => s.name.startsWith(prefix));
  }
  return state.bucket ? fetchServices(state.bucket) : [];
}

async function handleServicePick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  if (text === "back") {
    state.step = state.module === "additional" ? "PICKING_BUCKET" : "PICKING_VEHICLE_TYPE";
    state.bucket = undefined;
    await setWizardState(state);
    return {
      reply: state.module === "additional" ? bucketPrompt() : vehicleTypePrompt(),
    };
  }
  const services = await currentServiceList(state);
  const idx = parseChoice(text, services.length);
  if (idx == null) {
    return {
      reply:
        `Please reply with a number between 1 and ${services.length}, or BACK.\n\n` +
        (await (state.bucket === "scheduled_maintenance"
          ? maintenanceServicePrompt(state.vehicleType ?? "car")
          : state.bucket === "rsa"
            ? rsaServicePrompt()
            : detailingServicePrompt())),
    };
  }
  const picked = services[idx - 1]!;
  state.serviceIds = [picked.id];
  state.serviceNames = [picked.name];
  // RSA → ask area, skip slot picker later.
  state.step = "PICKING_AREA";
  await setWizardState(state);
  return { reply: await areaPrompt() };
}

// ── Step 4b: free-text description (Repairs / Denting) ─────────────────────

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
  state.step = "PICKING_AREA";
  await setWizardState(state);
  return { reply: await areaPrompt() };
}

// ── Step 5: area pick ──────────────────────────────────────────────────────

async function areaPrompt(): Promise<string> {
  const areas = await listActiveAreas();
  if (areas.length === 0) {
    return "We don't have any garages live yet. Please try autogtg.com instead.";
  }
  return [
    "Which area would you like to book in?",
    "",
    ...areas.map((a, i) => `${i + 1}. ${a}`),
    "",
    "Reply with the number.",
  ].join("\n");
}

async function handleAreaPick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const areas = await listActiveAreas();
  if (areas.length === 0) {
    await clearWizardState(state.phone);
    return {
      reply: "No active garages right now. Please try autogtg.com.",
    };
  }
  const idx = parseChoice(text, areas.length);
  if (idx == null) {
    return {
      reply: `Please reply with a number between 1 and ${areas.length}.\n\n` + (await areaPrompt()),
    };
  }
  state.area = areas[idx - 1];
  state.step = "PICKING_GARAGE";
  await setWizardState(state);
  return { reply: await garagePrompt(state) };
}

// ── Step 6: garage pick ────────────────────────────────────────────────────

async function fetchGarages(state: WizardState): Promise<Garage[]> {
  if (!state.area || !state.bucket) return [];
  return listGaragesByAreaAndBucket({
    area: state.area,
    bucket: state.bucket,
    limit: 10,
  });
}

async function garagePrompt(state: WizardState): Promise<string> {
  const garages = await fetchGarages(state);
  if (garages.length === 0) {
    return [
      `No garages in ${state.area} offer this service yet.`,
      "Reply BACK to pick another area, or CANCEL to stop.",
    ].join("\n");
  }
  return [
    `Garages in ${state.area}:`,
    "",
    ...garages.map(
      (g, i) =>
        `${i + 1}. ${g.shopName} — ★${g.rating.toFixed(1)} (${g.jobsCompleted} jobs)`,
    ),
    "",
    "Reply with the number, or BACK.",
  ].join("\n");
}

async function handleGaragePick(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  if (text === "back") {
    state.step = "PICKING_AREA";
    state.area = undefined;
    await setWizardState(state);
    return { reply: await areaPrompt() };
  }
  const garages = await fetchGarages(state);
  const idx = parseChoice(text, garages.length);
  if (idx == null) {
    return {
      reply: `Please reply 1-${garages.length} or BACK.\n\n` + (await garagePrompt(state)),
    };
  }
  const garage = garages[idx - 1]!;
  state.garageId = garage.id;
  state.garageName = garage.shopName;
  // For RSA, skip slot picker (urgent) and jump straight to vehicle details.
  if (state.bucket === "rsa") {
    state.slotLabel = "ASAP (RSA)";
    state.step = "PICKING_VEHICLE_DETAILS";
    await setWizardState(state);
    return { reply: vehicleDetailsPrompt(state) };
  }
  state.step = "PICKING_SLOT";
  await setWizardState(state);
  return { reply: slotPrompt() };
}

// ── Step 7: slot pick (skipped for RSA) ────────────────────────────────────

interface SlotOption {
  label: string;
  date: string;
  time: string;
}

function getSlotOptions(now: Date = new Date()): SlotOption[] {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const fmt = (d: Date) => {
    const ist = new Date(d.getTime() + istOffsetMs);
    return ist.toISOString().slice(0, 10);
  };
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const saturday = new Date(now);
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
    "Reply 1-4.",
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
      reply: `Please reply 1-${options.length}.\n\n` + slotPrompt(),
    };
  }
  const slot = options[idx - 1]!;
  state.slotLabel = slot.label;
  state.slotDate = slot.date;
  state.slotTime = slot.time;
  state.step = "PICKING_VEHICLE_DETAILS";
  await setWizardState(state);
  return { reply: vehicleDetailsPrompt(state) };
}

// ── Step 8: vehicle details (brand + model + optional reg) ─────────────────

function vehicleDetailsPrompt(state: WizardState): string {
  const ex =
    state.vehicleType === "bike"
      ? "Hero, Splendor, KA01AB1234"
      : "Maruti, Swift, JK01AB1234";
  return [
    `Your ${state.vehicleType === "bike" ? "bike" : "car"} details:`,
    "",
    "Reply with `Brand, Model, RegNumber` (registration optional).",
    `e.g. \`${ex}\``,
  ].join("\n");
}

async function handleVehicleDetails(
  state: WizardState,
  text: string,
): Promise<WizardResult> {
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    return {
      reply:
        "Please send at least brand and model, comma-separated.\n\n" + vehicleDetailsPrompt(state),
    };
  }
  state.vehicleBrand = parts[0];
  state.vehicleModel = parts[1];
  state.vehicleRegistration = parts[2] ?? undefined;
  state.step = "PICKING_PAYMENT";
  await setWizardState(state);
  return { reply: paymentPrompt() };
}

// ── Step 9: payment ────────────────────────────────────────────────────────

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

// ── Step 10: confirm ───────────────────────────────────────────────────────

function confirmPrompt(state: WizardState): string {
  const lines = [
    "📋 Booking summary:",
    "",
    `• Service: ${state.serviceNames?.join(", ") ?? state.bucket}`,
  ];
  if (state.description) lines.push(`• Issue: ${state.description}`);
  if (state.vehicleType) {
    const vehBits = [state.vehicleType === "bike" ? "Bike" : "Car"];
    if (state.vehicleBrand) vehBits.push(state.vehicleBrand);
    if (state.vehicleModel) vehBits.push(state.vehicleModel);
    if (state.vehicleRegistration) vehBits.push(`(${state.vehicleRegistration})`);
    lines.push(`• Vehicle: ${vehBits.join(" ")}`);
  }
  if (state.garageName) lines.push(`• Garage: ${state.garageName} (${state.area})`);
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
      garageId: state.garageId ?? null,
      slotLabel: state.slotLabel,
      slotDate: state.slotDate ?? null,
      slotTime: state.slotTime ?? null,
      paymentMode: state.paymentMode,
      symptoms,
      denting,
      vehicleType: state.vehicleType ?? null,
      vehicleBrand: state.vehicleBrand ?? null,
      vehicleModel: state.vehicleModel ?? null,
      vehicleRegistration: state.vehicleRegistration ?? null,
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
        garageId: booking.garageId,
        vehicleType: booking.vehicleType,
      },
      outcome: "success",
    });

    // RSA bookings get a special template that signals urgency to the customer.
    if (state.bucket === "rsa") {
      await notifyTemplate({
        to: state.phone,
        template: "rsa_acknowledged",
        variables: [profile.firstName ?? "there", booking.shortId],
        bookingId: booking.id,
      });
    }

    await clearWizardState(state.phone);
    return {
      reply: [
        `🎉 Booking confirmed: *${booking.shortId}*`,
        "",
        state.bucket === "rsa"
          ? "We're dispatching a mechanic now — our team is calling you to confirm details."
          : "Our team will call you in a few minutes to confirm details and the exact quote.",
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
