import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { getBookingById } from "@/lib/bookings/data";
import { addBookingNote, listBookingNotes } from "@/lib/bookings/notes";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

/**
 * GET  /api/ops/bookings/[id]/notes — newest first
 * POST /api/ops/bookings/[id]/notes — body: { body: string }
 *
 * Ops session required. Notes are visible to ops and (later) the assigned
 * garage; never to the customer.
 */

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const notes = await listBookingNotes(id);
  return NextResponse.json({ notes });
}

interface PostBody {
  body?: unknown;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const existing = await getBookingById(id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const noteBody = typeof body.body === "string" ? body.body.trim() : "";
  if (noteBody.length === 0 || noteBody.length > 4000) {
    return NextResponse.json(
      { error: "invalid_body", detail: "note must be 1–4000 chars" },
      { status: 400 },
    );
  }

  const actor = session.email ?? session.sub;
  try {
    const note = await addBookingNote({
      bookingId: id,
      author: actor,
      body: noteBody,
    });
    await appendAuditEntry({
      action: "add_booking_note",
      entityType: "booking",
      entityId: id,
      actor,
      payload: { noteId: note.id },
      outcome: "success",
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "add_booking_note",
      entityType: "booking",
      entityId: id,
      actor,
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
