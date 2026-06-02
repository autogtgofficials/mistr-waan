import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import {
  getGarageById,
  setGarageOnboardingStatus,
  type GarageOnboardingStatus,
} from "@/lib/garage/data";
import { notifyTemplate } from "@/lib/notifications/outbox";
import { appendAuditEntry } from "@/lib/audit/log";

export const runtime = "nodejs";

interface PatchBody {
  onboarding_status?: unknown;
  active?: unknown;
  rejected_reason?: unknown;
}

const VALID_STATUSES: GarageOnboardingStatus[] = [
  "pending_verification",
  "active",
  "rejected",
  "suspended",
];

/**
 * PATCH /api/ops/garages/[id]
 *
 * Body: { onboarding_status?: GarageOnboardingStatus, active?: boolean,
 *         rejected_reason?: string }
 *
 * Ops uses this to activate / reject / suspend a garage. On `active`
 * transition we fire `mechanic_activated` WA; on `rejected` we fire
 * `mechanic_rejected` with the reason.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const status =
    typeof body.onboarding_status === "string" &&
    VALID_STATUSES.includes(body.onboarding_status as GarageOnboardingStatus)
      ? (body.onboarding_status as GarageOnboardingStatus)
      : null;
  const activeRaw = body.active;
  const active = typeof activeRaw === "boolean" ? activeRaw : null;
  const rejectedReason =
    typeof body.rejected_reason === "string"
      ? body.rejected_reason.trim().slice(0, 500)
      : null;

  if (!status && active == null) {
    return NextResponse.json(
      { error: "nothing_to_update" },
      { status: 400 },
    );
  }

  const before = await getGarageById(id);
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const actor = session.email ?? session.sub;
  try {
    await setGarageOnboardingStatus({
      garageId: id,
      // Default to whatever's there if not provided; required-by-helper.
      status: status ?? (before.onboardingStatus ?? "pending_verification"),
      active: active ?? undefined,
    });

    // Notification: fire-and-log; never block on send failure.
    let notificationOutcome: "sent" | "skipped" | "failed" = "skipped";
    const ownerPhone = before.whatsappPhone ?? before.phone;
    if (status === "active" && ownerPhone) {
      const res = await notifyTemplate({
        to: ownerPhone,
        template: "mechanic_activated",
        variables: [before.ownerFirstName, before.shopName],
      });
      notificationOutcome = res.error ? "failed" : "sent";
    } else if (status === "rejected" && ownerPhone) {
      const res = await notifyTemplate({
        to: ownerPhone,
        template: "mechanic_rejected",
        variables: [
          before.ownerFirstName,
          rejectedReason ?? "Please contact our team for details.",
        ],
      });
      notificationOutcome = res.error ? "failed" : "sent";
    }

    await appendAuditEntry({
      action: status === "active" ? "activate_garage" : status === "rejected" ? "reject_garage" : "patch_garage_onboarding",
      entityType: "garage",
      entityId: id,
      actor,
      payload: { status, active, rejectedReason, notificationOutcome },
      before: {
        onboardingStatus: before.onboardingStatus,
        active: before.active,
      },
      outcome: "success",
    });
    return NextResponse.json({ ok: true, notificationOutcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await appendAuditEntry({
      action: "patch_garage_onboarding",
      entityType: "garage",
      entityId: id,
      actor,
      payload: { status, active, rejectedReason },
      outcome: "error",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
