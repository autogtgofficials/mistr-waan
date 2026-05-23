import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { ensureReferralCode } from "@/lib/referrals/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/me/referral
 *
 * Returns the current customer's referral code (lazy-generated), the
 * count of rewarded referrals, and their current loyalty point balance.
 */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = await ensureReferralCode(session.sub);
  const supabase = getSupabaseAdmin();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("loyalty_points, first_name")
      .eq("id", session.sub)
      .maybeSingle(),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", session.sub)
      .eq("state", "rewarded"),
  ]);

  return NextResponse.json({
    referralCode: code,
    loyaltyPoints: profile?.loyalty_points ?? 0,
    rewardedCount: count ?? 0,
    firstName: profile?.first_name ?? null,
    shareUrl: shareUrlFor(code),
  });
}

function shareUrlFor(code: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://autogtg.com";
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}
