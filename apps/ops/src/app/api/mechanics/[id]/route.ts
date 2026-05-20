import { NextResponse } from "next/server";
import { getMechanic, patchMechanic } from "@/lib/mechanics/data";
import {
  ONBOARDING_STATUSES,
  OUTREACH_OUTCOMES,
  type MechanicPatch,
} from "@/lib/mechanics/types";
import { appendAuditEntry } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const actor = request.headers.get("x-actor") ?? "unknown";
  const body = (await request.json()) as MechanicPatch;

  if (
    body.onboardingStatus !== undefined &&
    !ONBOARDING_STATUSES.includes(body.onboardingStatus)
  ) {
    return NextResponse.json({ error: "invalid onboardingStatus" }, { status: 400 });
  }
  if (
    body.outreachOutcome !== undefined &&
    !OUTREACH_OUTCOMES.includes(body.outreachOutcome)
  ) {
    return NextResponse.json({ error: "invalid outreachOutcome" }, { status: 400 });
  }

  const before = await getMechanic(id);
  if (!before) {
    await appendAuditEntry({
      action: "patch_mechanic",
      entityType: "mechanic",
      entityId: id,
      actor,
      payload: body,
      outcome: "error",
      error: "not found",
    });
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await patchMechanic(id, body);
  await appendAuditEntry({
    action: "patch_mechanic",
    entityType: "mechanic",
    entityId: id,
    actor,
    payload: body,
    before: {
      onboardingStatus: before.onboardingStatus,
      outreachOutcome: before.outreachOutcome,
      notes: before.notes,
    },
    outcome: "success",
  });
  return NextResponse.json(updated);
}
