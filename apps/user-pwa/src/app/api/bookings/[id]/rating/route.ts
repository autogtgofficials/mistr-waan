import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { getBookingById, getBookingByShortId } from "@/lib/bookings/data";
import { addBookingRating } from "@/lib/bookings/ratings";
import { appendAuditEntry } from "@/lib/audit/log";
import { isValidShortId } from "@/lib/supabase/short-id";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RatingBody {
  score?: unknown;
  comment?: unknown;
}

/**
 * POST /api/bookings/[id]/rating
 *
 * Body: { score: 1-5, comment?: string }
 *
 * Customer rates their completed booking's garage. One rating per booking.
 * Updates aggregate garage rating.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const booking = UUID_RE.test(id)
    ? await getBookingById(id)
    : isValidShortId(id)
      ? await getBookingByShortId(id)
      : null;
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (booking.profileId !== session.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: RatingBody;
  try {
    body = (await request.json()) as RatingBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  const comment =
    typeof body.comment === "string" && body.comment.trim().length > 0
      ? body.comment.trim().slice(0, 1000)
      : null;

  try {
    const updated = await addBookingRating({
      bookingId: booking.id,
      profileId: session.sub,
      score,
      comment,
    });
    await appendAuditEntry({
      action: "add_rating",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      payload: { score, comment },
      outcome: "success",
    });
    return NextResponse.json({ booking: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "add_rating",
      entityType: "booking",
      entityId: booking.id,
      actor: session.sub,
      payload: { score, comment },
      outcome: "error",
      error: message,
    });
    const status = message === "already_rated" ? 409 : message.includes("cannot rate") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
