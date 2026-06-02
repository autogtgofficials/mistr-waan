import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import {
  listGaragesByOnboardingStatus,
  type GarageOnboardingStatus,
} from "@/lib/garage/data";

export const runtime = "nodejs";

const VALID_STATUSES: GarageOnboardingStatus[] = [
  "pending_verification",
  "active",
  "rejected",
  "suspended",
];

/**
 * GET /api/ops/garages?status=pending_verification
 *
 * Ops-only. Lists garages filtered by onboarding status. Default status is
 * `pending_verification` so the page lands on the inbox of new applications.
 */
export async function GET(request: Request) {
  const session = await getOpsSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const requested = url.searchParams.get("status") ?? "pending_verification";
  const status = (
    VALID_STATUSES.includes(requested as GarageOnboardingStatus)
      ? requested
      : "pending_verification"
  ) as GarageOnboardingStatus;

  const garages = await listGaragesByOnboardingStatus(status);
  return NextResponse.json({ garages, status });
}
