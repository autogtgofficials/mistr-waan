import { NextResponse } from "next/server";
import { appendCallAttempt } from "@/lib/mechanics/data";
import {
  CONTACT_CHANNELS,
  OUTREACH_OUTCOMES,
  type CallAttempt,
  type ContactChannel,
  type OutreachOutcome,
} from "@/lib/mechanics/types";
import { appendAuditEntry } from "@/lib/audit/log";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const actor = request.headers.get("x-actor") ?? "unknown";
  const body = (await request.json()) as Omit<CallAttempt, "id" | "at"> & {
    at?: string;
  };

  if (!CONTACT_CHANNELS.includes(body.channel as ContactChannel)) {
    return NextResponse.json({ error: "invalid channel" }, { status: 400 });
  }
  if (!OUTREACH_OUTCOMES.includes(body.outcome as OutreachOutcome)) {
    return NextResponse.json({ error: "invalid outcome" }, { status: 400 });
  }

  const updated = await appendCallAttempt(id, body);
  if (!updated) {
    await appendAuditEntry({
      action: "add_call_attempt",
      entityType: "mechanic",
      entityId: id,
      actor,
      payload: { channel: body.channel, outcome: body.outcome },
      outcome: "error",
      error: "not found",
    });
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await appendAuditEntry({
    action: "add_call_attempt",
    entityType: "mechanic",
    entityId: id,
    actor,
    payload: {
      channel: body.channel,
      outcome: body.outcome,
      spokeWith: body.spokeWith,
      durationMin: body.durationMin,
    },
    outcome: "success",
  });
  return NextResponse.json(updated);
}
