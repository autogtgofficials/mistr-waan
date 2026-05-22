import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";

export const runtime = "nodejs";

/**
 * GET /api/auth/me
 * Returns the current customer profile based on the mw_session cookie.
 * Used by the client-side auth store to hydrate on mount.
 */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getProfileById(session.sub).catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  return NextResponse.json({ profile });
}
