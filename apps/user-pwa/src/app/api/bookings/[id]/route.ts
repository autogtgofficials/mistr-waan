import { NextResponse } from "next/server";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById, getBookingByShortId } from "@/lib/bookings/data";
import { isValidShortId } from "@/lib/supabase/short-id";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const customer = await getCustomerSession();
  const ops = await getOpsSession();
  if (!customer && !ops) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Accept either a UUID (canonical) or a short_id (MW-XXXXXX) — confirmation
  // page uses the short_id, deep links from older systems may pass the UUID.
  let booking;
  if (UUID_RE.test(id)) {
    booking = await getBookingById(id);
  } else if (isValidShortId(id)) {
    booking = await getBookingByShortId(id);
  } else {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Customers can only see their own bookings. Ops sees everything.
  if (customer && !ops && booking.profileId !== customer.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ booking });
}
