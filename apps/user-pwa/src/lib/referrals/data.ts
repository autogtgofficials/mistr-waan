import "server-only";
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";

/**
 * Referral codes are 6-char alphanumeric (uppercase, no ambiguous chars).
 * Generated lazily on first request for a profile and cached on the row.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const REFERRAL_REWARD_POINTS = 200;

function generateCode(): string {
  const buf = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

/**
 * Ensure the given profile has a referral_code. Generates one if missing,
 * retrying on the (vanishingly small) chance of a collision. Returns the code.
 */
export async function ensureReferralCode(profileId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  if (!existing) throw new Error("profile not found");
  if (existing.referral_code) return existing.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", profileId);
    if (!updateErr) return code;
    // 23505 = unique violation; retry with a new code.
    if (updateErr.code !== "23505") {
      throw new Error(`referral_code update failed: ${updateErr.message}`);
    }
  }
  throw new Error("referral_code generation exceeded retry budget");
}

/** Find a profile by their referral code (case-insensitive). */
export async function findProfileByReferralCode(code: string): Promise<{ id: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("referral_code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`referral lookup failed: ${error.message}`);
  return data ?? null;
}

/**
 * Attach a referrer to a profile (called on signup with `?ref=...`).
 * Idempotent: only sets `referred_by` if not already set, and refuses to
 * self-refer.
 */
export async function claimReferral(opts: {
  profileId: string;
  code: string;
}): Promise<{ claimed: boolean; reason?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: me } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", opts.profileId)
    .maybeSingle();
  if (!me) return { claimed: false, reason: "profile_not_found" };
  if (me.referred_by) return { claimed: false, reason: "already_referred" };

  const referrer = await findProfileByReferralCode(opts.code);
  if (!referrer) return { claimed: false, reason: "code_not_found" };
  if (referrer.id === opts.profileId) {
    return { claimed: false, reason: "self_referral" };
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ referred_by: referrer.id })
    .eq("id", opts.profileId);
  if (updateErr) throw new Error(`referred_by update failed: ${updateErr.message}`);

  // Also create a pending referrals row so we can track + reward.
  // We use the referrer's code to satisfy `code text not null` if the
  // schema has it (it does on `referrals.code`).
  await supabase.from("referrals").insert({
    referrer_id: referrer.id,
    referee_id: opts.profileId,
    code: opts.code.toUpperCase(),
    state: "pending",
  });

  return { claimed: true };
}

/**
 * Issue the referral reward when a referee's first booking completes.
 * Idempotent: silently no-ops if (a) the referee has no referrer, (b) we
 * already issued a reward, or (c) the referee has prior completed bookings.
 *
 * Bumps both parties' loyalty_points + flips the referrals row to 'rewarded'
 * + sends the referrer a `referral_reward` WhatsApp.
 */
export async function maybeIssueReferralReward(opts: {
  refereeProfileId: string;
  completedBookingId: string;
}): Promise<{ issued: boolean; reason?: string }> {
  const supabase = getSupabaseAdmin();

  const { data: referee } = await supabase
    .from("profiles")
    .select("id, first_name, referred_by, loyalty_points")
    .eq("id", opts.refereeProfileId)
    .maybeSingle();
  if (!referee?.referred_by) return { issued: false, reason: "no_referrer" };

  // Don't re-reward — exactly one reward per pair, regardless of how many
  // bookings the referee completes.
  const { data: existing } = await supabase
    .from("referrals")
    .select("id, state")
    .eq("referee_id", opts.refereeProfileId)
    .eq("referrer_id", referee.referred_by)
    .maybeSingle();
  if (existing?.state === "rewarded") return { issued: false, reason: "already_rewarded" };

  // Only reward on the first completed booking — count prior completions
  // (excluding the current one, which is `opts.completedBookingId`).
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", opts.refereeProfileId)
    .eq("status", "completed")
    .neq("id", opts.completedBookingId);
  if ((count ?? 0) > 0) return { issued: false, reason: "not_first_completion" };

  // Bump both parties' loyalty_points and mark the referral rewarded.
  const { data: referrer } = await supabase
    .from("profiles")
    .select("id, phone, first_name, loyalty_points")
    .eq("id", referee.referred_by)
    .maybeSingle();
  if (!referrer) return { issued: false, reason: "referrer_not_found" };

  await Promise.all([
    supabase
      .from("profiles")
      .update({ loyalty_points: referrer.loyalty_points + REFERRAL_REWARD_POINTS })
      .eq("id", referrer.id),
    supabase
      .from("profiles")
      .update({ loyalty_points: referee.loyalty_points + REFERRAL_REWARD_POINTS })
      .eq("id", referee.id),
    existing
      ? supabase
          .from("referrals")
          .update({ state: "rewarded", reward_amount: REFERRAL_REWARD_POINTS })
          .eq("id", existing.id)
      : supabase.from("referrals").insert({
          referrer_id: referrer.id,
          referee_id: referee.id,
          code: "AUTO",
          state: "rewarded",
          reward_amount: REFERRAL_REWARD_POINTS,
        }),
  ]);

  // Best-effort WhatsApp notification to the referrer.
  if (referrer.phone) {
    await notifyTemplate({
      to: referrer.phone,
      template: "referral_reward",
      variables: [
        referrer.first_name ?? "there",
        String(REFERRAL_REWARD_POINTS),
      ],
    });
  }

  await appendAuditEntry({
    action: "issue_referral_reward",
    entityType: "referral",
    entityId: opts.refereeProfileId,
    actor: "system",
    payload: {
      referrerId: referrer.id,
      points: REFERRAL_REWARD_POINTS,
      bookingId: opts.completedBookingId,
    },
    outcome: "success",
  });

  return { issued: true };
}
