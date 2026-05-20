import { NextResponse } from "next/server";
import { updateMechanic } from "@/lib/mechanics/data";
import { ONBOARDING_STATUSES, type OnboardingStatus } from "@/lib/mechanics/types";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    onboardingStatus?: OnboardingStatus;
    notes?: string | null;
  };

  if (
    body.onboardingStatus !== undefined &&
    !ONBOARDING_STATUSES.includes(body.onboardingStatus)
  ) {
    return NextResponse.json({ error: "invalid onboardingStatus" }, { status: 400 });
  }

  const updated = await updateMechanic(id, body);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updated);
}
