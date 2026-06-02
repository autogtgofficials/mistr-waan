import "server-only";
import { getBookingByShortId, getBookingById } from "@/lib/bookings/data";
import { respondToAssignment } from "@/lib/bookings/assign";
import { cancelJob, completeJob, startJob } from "@/lib/bookings/lifecycle";
import { listBookingsForProfile } from "@/lib/bookings/data";
import { addBookingRating } from "@/lib/bookings/ratings";
import { uploadBookingPhoto } from "@/lib/bookings/photos";
import { notifyText, notifyTemplate, recordInbound } from "@/lib/notifications/outbox";
import { findGarageByPhone, setGarageActive, type Garage } from "@/lib/garage/data";
import { listGarageJobs } from "@/lib/garage/jobs";
import { findProfileByPhone } from "@/lib/auth/profile";
import { ensureReferralCode } from "@/lib/referrals/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEntry } from "@/lib/audit/log";
import { handleWizardMessage } from "./bot/wizard";
import { getWizardState } from "./bot/state";
import {
  clearPhotoRequest,
  getPhotoRequest,
  incrementPhotoRequestCount,
} from "./bot/photo-requests";
import {
  getOnboardingState,
  handleOnboardingMessage,
  isOnboardingEntry,
} from "./bot/onboarding-wizard";
import { downloadMediaBytes } from "./client";
import type { InboundMessage } from "./types";
import { isValidShortId } from "@/lib/supabase/short-id";
import { rupees } from "@/lib/utils";

/**
 * Router for inbound WhatsApp messages.
 *
 * Priority order:
 *   1. Interactive button replies (Accept/Decline on garage_new_job)
 *   2. Garage identity → garage commands (jobs, accept, decline, start, complete)
 *   3. Customer wizard session OR wizard entry trigger → booking wizard
 *   4. Customer free-text commands (book, track, cancel, help)
 *
 * Never throws — Meta retries non-2xx, so all paths catch + audit failures
 * and return early.
 */

const BUTTON_RE = /^booking:([A-Z0-9-]+):(accept|decline)$/i;

export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  await recordInbound({
    from: msg.from,
    messageId: msg.messageId,
    type: msg.type,
    body: msg.text ?? null,
    interactiveId: msg.interactiveId ?? null,
    raw: msg.raw,
  });

  // 1. Button replies always win — explicit user action on a template button.
  if (msg.interactiveId) {
    const m = msg.interactiveId.match(BUTTON_RE);
    if (m) {
      await handleGarageButton({
        shortId: m[1]!.toUpperCase(),
        outcome: m[2]!.toLowerCase() as "accept" | "decline",
        from: msg.from,
      });
      return;
    }
  }

  // 1b. Media inbound (image or PDF). Two possible owners:
  //     - active mechanic onboarding wizard at VERIFICATION_DOC step → store
  //       to verification-docs bucket via the onboarding wizard
  //     - active ops PhotoRequest → store to booking-photos bucket
  //     Onboarding takes precedence (mechanic is actively answering a prompt).
  if (msg.media) {
    const onboarding = await getOnboardingState(msg.from).catch(() => null);
    if (onboarding && onboarding.step === "VERIFICATION_DOC") {
      const result = await handleOnboardingMessage({
        phone: msg.from,
        text: "",
        media: msg.media,
      });
      if (result.reply) await notifyText({ to: msg.from, body: result.reply });
      return;
    }
    if (msg.media.mimeType?.startsWith("image/")) {
      const active = await getPhotoRequest(msg.from).catch(() => null);
      if (active) {
        await handleInboundBookingPhoto({
          media: msg.media,
          from: msg.from,
          bookingId: active.bookingId,
          bookingShortId: active.bookingShortId,
        });
        return;
      }
    }
    // No active request → fall through to text routing.
  }

  const text = (msg.text ?? "").trim();
  // DONE while a photo request is active → clear it + thank the customer.
  if (
    text.toLowerCase() === "done" &&
    (await getPhotoRequest(msg.from).catch(() => null))
  ) {
    await clearPhotoRequest(msg.from);
    await notifyText({
      to: msg.from,
      body: "✓ Thanks! Our team can see your photos now.",
    });
    return;
  }

  if (!text) return;

  // 2. Garage identity → garage routing
  let garage: Garage | null = null;
  try {
    garage = await findGarageByPhone(msg.from);
  } catch (err) {
    console.warn("[intents] garage lookup failed", err);
  }
  if (garage) {
    await handleGarageMessage({ garage, from: msg.from, text });
    return;
  }

  // 3. Mechanic onboarding — in-session OR an entry trigger from an
  //    UNKNOWN phone (already-onboarded garages caught by step 2).
  const onboardingState = await getOnboardingState(msg.from).catch(() => null);
  if (onboardingState || isOnboardingEntry(text)) {
    const result = await handleOnboardingMessage({ phone: msg.from, text });
    if (result.reply) await notifyText({ to: msg.from, body: result.reply });
    return;
  }

  // 4. Customer wizard — in-session OR an entry trigger
  const wizardState = await getWizardState(msg.from).catch(() => null);
  if (wizardState || isWizardEntry(text)) {
    const result = await handleWizardMessage({ phone: msg.from, text });
    if (result.reply) {
      await notifyText({ to: msg.from, body: result.reply });
    }
    return;
  }

  // 5. Customer free-text commands
  await handleCustomerMessage({ from: msg.from, text });
}

function isWizardEntry(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "book" || t === "start" || t === "new booking" || t === "new";
}

// ── Garage commands ─────────────────────────────────────────────────────────

async function handleGarageMessage(opts: {
  garage: Garage;
  from: string;
  text: string;
}): Promise<void> {
  const { garage, from, text } = opts;
  const lower = text.toLowerCase().trim();

  if (
    lower === "help" ||
    lower === "hi" ||
    lower === "hello" ||
    lower === "menu" ||
    lower === "start"
  ) {
    await notifyText({ to: from, body: garageHelpText(garage) });
    return;
  }

  if (lower === "jobs" || lower === "my jobs" || lower === "list") {
    await handleGarageJobsList({ garage, from });
    return;
  }

  if (lower === "earnings" || lower === "balance" || lower === "payout") {
    await handleGarageEarnings({ garage, from });
    return;
  }

  if (lower === "pause" || lower === "stop accepting") {
    await handleGaragePauseResume({ garage, from, active: false });
    return;
  }

  if (lower === "resume" || lower === "unpause" || lower === "start accepting") {
    await handleGaragePauseResume({ garage, from, active: true });
    return;
  }

  const startMatch = lower.match(/^start\s+(ag-[a-z0-9-]+)$/i);
  if (startMatch) {
    await handleGarageStart({
      garage,
      from,
      shortId: startMatch[1]!.toUpperCase(),
    });
    return;
  }
  const completeMatch = lower.match(/^(?:complete|done|finish)\s+(ag-[a-z0-9-]+)$/i);
  if (completeMatch) {
    await handleGarageComplete({
      garage,
      from,
      shortId: completeMatch[1]!.toUpperCase(),
    });
    return;
  }
  const acceptMatch = lower.match(/^accept\s+(ag-[a-z0-9-]+)$/i);
  if (acceptMatch) {
    await handleGarageRespond({
      garage,
      from,
      shortId: acceptMatch[1]!.toUpperCase(),
      outcome: "accept",
    });
    return;
  }
  const declineMatch = lower.match(/^decline\s+(ag-[a-z0-9-]+)$/i);
  if (declineMatch) {
    await handleGarageRespond({
      garage,
      from,
      shortId: declineMatch[1]!.toUpperCase(),
      outcome: "decline",
    });
    return;
  }

  await notifyText({
    to: from,
    body: "Sorry, I didn't get that. Reply HELP for commands.",
  });
  await appendAuditEntry({
    action: "whatsapp_unknown_intent",
    entityType: "whatsapp_message",
    entityId: from,
    actor: from,
    payload: { text, role: "garage", garageId: garage.id },
    outcome: "success",
  });
}

function garageHelpText(garage: Garage): string {
  return [
    `Hi ${garage.ownerFirstName} — AutoGTG garage commands:`,
    "",
    "Jobs:",
    "• JOBS — your active jobs",
    "• ACCEPT AG-XXXXXX — accept a new job",
    "• DECLINE AG-XXXXXX — pass on a job",
    "• START AG-XXXXXX — mark a job in progress",
    "• COMPLETE AG-XXXXXX — mark a job done",
    "",
    "Account:",
    "• EARNINGS — recent earnings + commission balance",
    "• PAUSE — stop receiving new jobs",
    "• RESUME — start receiving new jobs again",
    "",
    "Or use the app: garage.autogtg.com",
  ].join("\n");
}

async function handleGarageJobsList(opts: {
  garage: Garage;
  from: string;
}): Promise<void> {
  let jobs;
  try {
    jobs = await listGarageJobs(opts.garage.id);
  } catch (err) {
    console.error("[intents] list jobs failed", err);
    await notifyText({
      to: opts.from,
      body: "Couldn't fetch jobs right now. Try again in a moment.",
    });
    return;
  }
  const active = jobs.filter(
    (j) =>
      j.status === "awaiting_garage" ||
      j.status === "assigned" ||
      j.status === "in_progress",
  );
  if (active.length === 0) {
    await notifyText({
      to: opts.from,
      body: "No active jobs right now. We'll WhatsApp you when a new one comes in.",
    });
    return;
  }
  const lines = ["📋 Your active jobs:", ""];
  for (const j of active.slice(0, 10)) {
    const action =
      j.status === "awaiting_garage"
        ? `ACCEPT ${j.shortId} / DECLINE ${j.shortId}`
        : j.status === "assigned"
          ? `START ${j.shortId} when work begins`
          : `COMPLETE ${j.shortId} when done`;
    const service = j.services?.[0]?.name ?? j.bucket;
    lines.push(`${j.shortId} — ${service}`);
    lines.push(`  ${j.customerLabel} · ${j.slotLabel}`);
    lines.push(`  → ${action}`);
    lines.push("");
  }
  await notifyText({ to: opts.from, body: lines.join("\n").trim() });
}

async function handleGarageRespond(opts: {
  garage: Garage;
  from: string;
  shortId: string;
  outcome: "accept" | "decline";
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await notifyText({ to: opts.from, body: `Invalid booking id ${opts.shortId}.` });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking || booking.garageId !== opts.garage.id) {
    await notifyText({
      to: opts.from,
      body: `Booking ${opts.shortId} isn't assigned to you.`,
    });
    return;
  }
  try {
    const updated = await respondToAssignment({
      bookingId: booking.id,
      garageId: opts.garage.id,
      outcome: opts.outcome,
    });
    await notifyCustomerAboutRespond({
      bookingProfileId: booking.profileId,
      bookingId: booking.id,
      garage: opts.garage,
      outcome: opts.outcome,
      shortId: updated.shortId,
    });
    await notifyText({
      to: opts.from,
      body:
        opts.outcome === "accept"
          ? `✓ Accepted ${updated.shortId}. Customer notified. Reply START ${updated.shortId} when work begins.`
          : `✓ Declined ${updated.shortId}. Customer notified — ops will reassign.`,
    });
    await appendAuditEntry({
      action: "garage_respond_via_wa",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.garage.id,
      payload: { outcome: opts.outcome, source: "whatsapp_text" },
      before: { status: booking.status },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await notifyText({
      to: opts.from,
      body: `Couldn't ${opts.outcome} ${opts.shortId}: ${message}`,
    });
    await appendAuditEntry({
      action: "garage_respond_via_wa",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.garage.id,
      payload: { outcome: opts.outcome, source: "whatsapp_text" },
      outcome: "error",
      error: message,
    });
  }
}

async function handleGarageStart(opts: {
  garage: Garage;
  from: string;
  shortId: string;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await notifyText({ to: opts.from, body: `Invalid booking id ${opts.shortId}.` });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking || booking.garageId !== opts.garage.id) {
    await notifyText({
      to: opts.from,
      body: `Booking ${opts.shortId} isn't assigned to you.`,
    });
    return;
  }
  try {
    const updated = await startJob(booking.id);
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("id", booking.profileId)
      .maybeSingle();
    if (profile?.phone) {
      await notifyTemplate({
        to: profile.phone,
        template: "job_started",
        variables: [profile.first_name ?? "there", updated.shortId],
        bookingId: booking.id,
      });
    }
    await notifyText({
      to: opts.from,
      body: `✓ Started ${updated.shortId}. Customer notified. Reply COMPLETE ${updated.shortId} when done.`,
    });
    await appendAuditEntry({
      action: "garage_start_job",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.garage.id,
      payload: { source: "whatsapp_text" },
      before: { status: booking.status },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await notifyText({
      to: opts.from,
      body: `Couldn't start ${opts.shortId}: ${message}`,
    });
    await appendAuditEntry({
      action: "garage_start_job",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.garage.id,
      payload: { source: "whatsapp_text" },
      outcome: "error",
      error: message,
    });
  }
}

async function handleGarageEarnings(opts: {
  garage: Garage;
  from: string;
}): Promise<void> {
  let jobs;
  try {
    jobs = await listGarageJobs(opts.garage.id);
  } catch (err) {
    console.error("[intents] earnings list failed", err);
    await notifyText({
      to: opts.from,
      body: "Couldn't fetch earnings right now. Try again in a moment.",
    });
    return;
  }
  // Window: rolling 30 days from "now".
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentCompleted = jobs.filter(
    (j) => j.status === "completed" && new Date(j.completedAt ?? 0).getTime() >= cutoff,
  );
  const gross = recentCompleted.reduce((acc, j) => acc + (j.total ?? 0), 0);
  const commission = recentCompleted.reduce(
    (acc, j) => acc + (j.commissionCut ?? 0),
    0,
  );
  const cashCommissionOwed = recentCompleted
    .filter((j) => j.paymentMode === "cash")
    .reduce((acc, j) => acc + (j.commissionCut ?? 0), 0);
  const net = gross - commission;

  const lines = [
    `💰 ${opts.garage.shopName} — last 30 days`,
    "",
    `Completed jobs: ${recentCompleted.length}`,
    `Gross: ${rupees(gross)}`,
    `AutoGTG fee: ${rupees(commission)} (${opts.garage.commissionPct}%)`,
    `Your net: ${rupees(net)}`,
  ];
  if (cashCommissionOwed > 0) {
    lines.push(
      "",
      `⚠️ Commission owed on cash jobs: ${rupees(cashCommissionOwed)}`,
      "Settle weekly via UPI to +91 80000 11122.",
    );
  }
  await notifyText({ to: opts.from, body: lines.join("\n") });
}

async function handleGaragePauseResume(opts: {
  garage: Garage;
  from: string;
  active: boolean;
}): Promise<void> {
  if (opts.garage.active === opts.active) {
    await notifyText({
      to: opts.from,
      body: opts.active
        ? "You're already accepting new jobs. ✓"
        : "You're already paused. New jobs won't be assigned.",
    });
    return;
  }
  try {
    await setGarageActive(opts.garage.id, opts.active);
    await notifyText({
      to: opts.from,
      body: opts.active
        ? "✓ Resumed. We'll send you new jobs again."
        : "✓ Paused. Ops won't assign new jobs to you until you reply RESUME. Existing jobs are unaffected.",
    });
    await appendAuditEntry({
      action: opts.active ? "garage_resume" : "garage_pause",
      entityType: "garage",
      entityId: opts.garage.id,
      actor: opts.garage.id,
      payload: { source: "whatsapp_text" },
      before: { active: opts.garage.active },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await notifyText({
      to: opts.from,
      body: `Couldn't update status: ${message}`,
    });
  }
}

async function handleGarageComplete(opts: {
  garage: Garage;
  from: string;
  shortId: string;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await notifyText({ to: opts.from, body: `Invalid booking id ${opts.shortId}.` });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking || booking.garageId !== opts.garage.id) {
    await notifyText({
      to: opts.from,
      body: `Booking ${opts.shortId} isn't assigned to you.`,
    });
    return;
  }
  try {
    const updated = await completeJob(booking.id);
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("id", booking.profileId)
      .maybeSingle();
    if (profile?.phone) {
      await notifyTemplate({
        to: profile.phone,
        template: "job_complete",
        variables: [updated.shortId],
        bookingId: booking.id,
      });
    }
    await notifyText({
      to: opts.from,
      body: `✓ Completed ${updated.shortId}. Customer notified.`,
    });
    await appendAuditEntry({
      action: "garage_complete_job",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.garage.id,
      payload: { source: "whatsapp_text" },
      before: { status: booking.status },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await notifyText({
      to: opts.from,
      body: `Couldn't complete ${opts.shortId}: ${message}`,
    });
    await appendAuditEntry({
      action: "garage_complete_job",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.garage.id,
      payload: { source: "whatsapp_text" },
      outcome: "error",
      error: message,
    });
  }
}

// ── Customer commands ──────────────────────────────────────────────────────

async function handleCustomerMessage(opts: {
  from: string;
  text: string;
}): Promise<void> {
  const lower = opts.text.toLowerCase().trim();

  if (
    lower === "help" ||
    lower === "hi" ||
    lower === "hello" ||
    lower === "menu"
  ) {
    await notifyText({ to: opts.from, body: customerHelpText() });
    return;
  }

  if (
    lower === "my bookings" ||
    lower === "bookings" ||
    lower === "my orders"
  ) {
    await handleCustomerBookingsList({ from: opts.from });
    return;
  }

  if (
    lower === "referral" ||
    lower === "my code" ||
    lower === "refer" ||
    lower === "points" ||
    lower === "loyalty"
  ) {
    await handleCustomerReferral({ from: opts.from });
    return;
  }

  const trackMatch = lower.match(/^track\s+(ag-[a-z0-9-]+)$/i);
  if (trackMatch) {
    await handleTrack({
      from: opts.from,
      shortId: trackMatch[1]!.toUpperCase(),
    });
    return;
  }

  const cancelMatch = lower.match(/^cancel\s+(ag-[a-z0-9-]+)$/i);
  if (cancelMatch) {
    await handleCustomerCancel({
      from: opts.from,
      shortId: cancelMatch[1]!.toUpperCase(),
    });
    return;
  }

  // RATE AG-XXXXXX <1-5> [free-text comment]
  const rateMatch = opts.text
    .trim()
    .match(/^rate\s+(AG-[A-Z0-9-]+)\s+([1-5])(?:\s+(.+))?$/i);
  if (rateMatch) {
    await handleCustomerRate({
      from: opts.from,
      shortId: rateMatch[1]!.toUpperCase(),
      score: Number(rateMatch[2]),
      comment: rateMatch[3] ?? null,
    });
    return;
  }

  // Unknown — nudge to BOOK / HELP. Log silently.
  await appendAuditEntry({
    action: "whatsapp_unknown_intent",
    entityType: "whatsapp_message",
    entityId: opts.from,
    actor: opts.from,
    payload: { text: opts.text, role: "customer" },
    outcome: "success",
  });
  await notifyText({
    to: opts.from,
    body:
      "Sorry, I didn't get that. Reply BOOK to start a booking, TRACK <AG-XXXXXX> for status, or HELP for more.",
  });
}

function customerHelpText(): string {
  return [
    "AutoGTG — Kashmir's car care.",
    "",
    "Reply with:",
    "• BOOK — start a new booking",
    "• MY BOOKINGS — recent bookings",
    "• TRACK AG-XXXXXX — booking status",
    "• CANCEL AG-XXXXXX — cancel (>1hr before slot)",
    "• RATE AG-XXXXXX 5 great service — rate a completed job",
    "• REFERRAL — your code + loyalty points",
    "",
    "Or visit autogtg.com.",
  ].join("\n");
}

async function handleTrack(opts: {
  from: string;
  shortId: string;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) return;
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking) {
    await notifyText({
      to: opts.from,
      body: `No booking found for ${opts.shortId}.`,
    });
    return;
  }
  const lines = [
    `Booking ${booking.shortId}`,
    `Status: ${booking.status.replace(/_/g, " ")}`,
    `Slot: ${booking.slotLabel}`,
  ];
  if (booking.total != null) lines.push(`Total: ₹${booking.total}`);
  if (booking.garage?.shopName) lines.push(`Garage: ${booking.garage.shopName}`);
  await notifyText({
    to: opts.from,
    body: lines.join("\n"),
    bookingId: booking.id,
  });
}

async function handleCustomerBookingsList(opts: {
  from: string;
}): Promise<void> {
  const profile = await findProfileByPhone(opts.from);
  if (!profile) {
    await notifyText({
      to: opts.from,
      body: "No bookings yet. Reply BOOK to start one!",
    });
    return;
  }
  let bookings;
  try {
    bookings = await listBookingsForProfile(profile.id);
  } catch (err) {
    console.error("[intents] bookings list failed", err);
    await notifyText({
      to: opts.from,
      body: "Couldn't fetch your bookings right now. Try again in a moment.",
    });
    return;
  }
  if (bookings.length === 0) {
    await notifyText({
      to: opts.from,
      body: "No bookings yet. Reply BOOK to start one!",
    });
    return;
  }
  // Show up to 5 most recent. listBookingsForProfile returns newest first.
  const recent = bookings.slice(0, 5);
  const lines = ["📋 Your recent bookings:", ""];
  for (const b of recent) {
    const total = b.total != null ? rupees(b.total) : "—";
    lines.push(
      `${b.shortId} · ${b.bucket} · ${b.status.replace(/_/g, " ")}`,
      `  Slot: ${b.slotLabel} · ${total}`,
      `  → TRACK ${b.shortId}`,
      "",
    );
  }
  if (bookings.length > 5) {
    lines.push(`+ ${bookings.length - 5} older — see autogtg.com/bookings`);
  }
  await notifyText({ to: opts.from, body: lines.join("\n").trim() });
}

async function handleCustomerReferral(opts: { from: string }): Promise<void> {
  const profile = await findProfileByPhone(opts.from);
  if (!profile) {
    await notifyText({
      to: opts.from,
      body:
        "You'll get a referral code on your first booking. " +
        "Reply BOOK to start.",
    });
    return;
  }
  let code: string;
  try {
    code = await ensureReferralCode(profile.id);
  } catch (err) {
    console.error("[intents] referral code failed", err);
    await notifyText({
      to: opts.from,
      body: "Couldn't fetch your code right now. Try again in a moment.",
    });
    return;
  }
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://autogtg.com";
  await notifyText({
    to: opts.from,
    body: [
      "🎁 Your AutoGTG referral",
      "",
      `Code: ${code}`,
      `Share link: ${origin}/?ref=${code}`,
      "",
      `Loyalty points: ${profile.loyaltyPoints}`,
      "",
      "When a friend signs up with your code and completes their first booking, you both get 200 points (₹200 off).",
    ].join("\n"),
  });
}

async function handleCustomerRate(opts: {
  from: string;
  shortId: string;
  score: number;
  comment: string | null;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await notifyText({
      to: opts.from,
      body: `Invalid booking id ${opts.shortId}.`,
    });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking) {
    await notifyText({
      to: opts.from,
      body: `Booking ${opts.shortId} not found.`,
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", booking.profileId)
    .maybeSingle();
  const normFrom = normalisePhone(opts.from);
  if (!profile || normalisePhone(profile.phone) !== normFrom) {
    await notifyText({
      to: opts.from,
      body: `You can't rate booking ${opts.shortId} from this number.`,
    });
    return;
  }
  try {
    await addBookingRating({
      bookingId: booking.id,
      profileId: profile.id,
      score: opts.score,
      comment: opts.comment,
    });
    await notifyText({
      to: opts.from,
      body: `⭐ Thanks for rating ${opts.shortId} ${opts.score}/5!`,
    });
    await appendAuditEntry({
      action: "add_rating",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { score: opts.score, comment: opts.comment, source: "whatsapp_text" },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const friendly =
      message === "already_rated"
        ? `${opts.shortId} has already been rated.`
        : message.includes("cannot rate")
          ? `${opts.shortId} can't be rated yet — wait until it's completed.`
          : `Couldn't add rating: ${message}`;
    await notifyText({ to: opts.from, body: friendly });
    await appendAuditEntry({
      action: "add_rating",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { score: opts.score, source: "whatsapp_text" },
      outcome: "error",
      error: message,
    });
  }
}

async function handleCustomerCancel(opts: {
  from: string;
  shortId: string;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await notifyText({
      to: opts.from,
      body: `Invalid booking id ${opts.shortId}.`,
    });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking) {
    await notifyText({
      to: opts.from,
      body: `Booking ${opts.shortId} not found.`,
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, first_name")
    .eq("id", booking.profileId)
    .maybeSingle();
  const normFrom = normalisePhone(opts.from);
  if (!profile || normalisePhone(profile.phone) !== normFrom) {
    await notifyText({
      to: opts.from,
      body: `You can't cancel booking ${opts.shortId} from this number.`,
    });
    return;
  }
  try {
    const updated = await cancelJob({
      bookingId: booking.id,
      enforceCutoff: true,
      reason: "cancelled via whatsapp",
    });
    await notifyTemplate({
      to: opts.from,
      template: "booking_cancelled",
      variables: [profile.first_name ?? "there", updated.shortId],
      bookingId: booking.id,
    });
    await appendAuditEntry({
      action: "cancel_booking",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { source: "whatsapp_text" },
      before: { status: booking.status },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const friendly = message.startsWith("cutoff_exceeded")
      ? "Less than 1 hour to your slot — please WhatsApp ops to cancel."
      : `Couldn't cancel: ${message}`;
    await notifyText({ to: opts.from, body: friendly });
    await appendAuditEntry({
      action: "cancel_booking",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { source: "whatsapp_text" },
      outcome: "error",
      error: message,
    });
  }
}

// ── Garage button (template Accept/Decline) ────────────────────────────────

async function handleGarageButton(opts: {
  shortId: string;
  outcome: "accept" | "decline";
  from: string;
}): Promise<void> {
  if (!isValidShortId(opts.shortId)) {
    await appendAuditEntry({
      action: "whatsapp_garage_button",
      entityType: "booking",
      entityId: opts.shortId,
      actor: opts.from,
      outcome: "error",
      error: "invalid_short_id",
    });
    return;
  }
  const booking = await getBookingByShortId(opts.shortId);
  if (!booking || !booking.garageId) {
    await appendAuditEntry({
      action: "whatsapp_garage_button",
      entityType: "booking",
      entityId: opts.shortId,
      actor: opts.from,
      outcome: "error",
      error: booking ? "no_garage_assigned" : "not_found",
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: garageRow } = await supabase
    .from("garages")
    .select("id, phone, whatsapp_phone, shop_name, owner_first_name")
    .eq("id", booking.garageId)
    .maybeSingle();
  const expectedPhones = [garageRow?.phone, garageRow?.whatsapp_phone].filter(
    (p): p is string => Boolean(p),
  );
  const normFrom = normalisePhone(opts.from);
  const senderOk = expectedPhones.some(
    (p) => normalisePhone(p) === normFrom,
  );
  if (!senderOk) {
    await appendAuditEntry({
      action: "whatsapp_garage_button",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { shortId: opts.shortId, outcome: opts.outcome },
      outcome: "error",
      error: "sender_not_assigned_garage",
    });
    return;
  }

  try {
    const updated = await respondToAssignment({
      bookingId: booking.id,
      garageId: booking.garageId,
      outcome: opts.outcome,
    });
    await notifyCustomerAboutRespond({
      bookingProfileId: booking.profileId,
      bookingId: booking.id,
      garage: {
        shopName: garageRow?.shop_name ?? "your assigned garage",
        ownerFirstName: garageRow?.owner_first_name ?? "",
      },
      outcome: opts.outcome,
      shortId: updated.shortId,
    });
    await appendAuditEntry({
      action: "garage_respond_via_wa",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { outcome: opts.outcome, garageId: booking.garageId, source: "whatsapp_button" },
      before: { status: booking.status },
      outcome: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "garage_respond_via_wa",
      entityType: "booking",
      entityId: booking.id,
      actor: opts.from,
      payload: { outcome: opts.outcome, source: "whatsapp_button" },
      outcome: "error",
      error: message,
    });
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────

async function notifyCustomerAboutRespond(opts: {
  bookingProfileId: string;
  bookingId: string;
  garage: { shopName: string; ownerFirstName: string };
  outcome: "accept" | "decline";
  shortId: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, first_name")
    .eq("id", opts.bookingProfileId)
    .maybeSingle();
  if (!profile?.phone) return;
  if (opts.outcome === "accept") {
    await notifyTemplate({
      to: profile.phone,
      template: "mechanic_assigned",
      variables: [opts.garage.shopName, opts.shortId],
      bookingId: opts.bookingId,
    });
  } else {
    await notifyTemplate({
      to: profile.phone,
      template: "garage_declined",
      variables: [profile.first_name ?? "there", opts.shortId],
      bookingId: opts.bookingId,
    });
  }
}

function normalisePhone(p: string): string {
  return p.replace(/\D+/g, "");
}

/**
 * Customer sent an image while a PhotoRequest is open. Download the media
 * from Meta and upload to Storage as a booking_photos row. Reply with a
 * progress message and clear the request when the cap is hit.
 *
 * Failures are caught + audited so we always return 200 to Meta.
 */
async function handleInboundBookingPhoto(opts: {
  media: NonNullable<InboundMessage["media"]>;
  from: string;
  bookingId: string;
  bookingShortId: string;
}): Promise<void> {
  try {
    const { bytes, mimeType } = await downloadMediaBytes(opts.media.id);
    await uploadBookingPhoto({
      bookingId: opts.bookingId,
      bytes,
      mimeType: opts.media.mimeType || mimeType,
    });
    const updated = await incrementPhotoRequestCount(opts.from);
    const photosSoFar = updated?.photosSoFar ?? 0;
    const cap = updated?.maxPhotos ?? 8;
    await appendAuditEntry({
      action: "upload_photo",
      entityType: "booking",
      entityId: opts.bookingId,
      actor: opts.from,
      payload: {
        source: "whatsapp_text",
        mediaId: opts.media.id,
        photosSoFar,
        cap,
      },
      outcome: "success",
    });
    const reply =
      photosSoFar >= cap
        ? `📸 Got ${photosSoFar}/${cap} — that's the max. Our team can see them now, thanks!`
        : `📸 Got photo ${photosSoFar}/${cap}. Send more or reply DONE.`;
    await notifyText({ to: opts.from, body: reply, bookingId: opts.bookingId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "upload_photo",
      entityType: "booking",
      entityId: opts.bookingId,
      actor: opts.from,
      payload: { source: "whatsapp_text", mediaId: opts.media.id },
      outcome: "error",
      error: message,
    });
    await notifyText({
      to: opts.from,
      body: "Sorry, that photo didn't go through. Please try again.",
    });
  }
}

export { getBookingById };
