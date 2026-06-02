import { NextResponse } from "next/server";
import { getCustomerSession, getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { getLatestPaymentForBooking } from "@/lib/payments/data";

export const runtime = "nodejs";

/**
 * GET /api/bookings/[id]/payment
 *
 * Returns the latest payment row for this booking (or null if none yet).
 * Used by the /bookings/[id] page to decide whether to show "Pay now",
 * "Payment pending", or a captured summary.
 */
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
  const booking = await getBookingById(id);
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (customer && !ops && booking.profileId !== customer.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const payment = await getLatestPaymentForBooking(booking.id);
  return NextResponse.json({ payment });
}
