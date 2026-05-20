import { NextResponse } from "next/server";
import { createMechanic, type NewMechanicInput } from "@/lib/mechanics/data";
import { appendAuditEntry } from "@/lib/audit/log";
import { ONBOARDING_STATUSES } from "@/lib/mechanics/types";

export async function POST(request: Request) {
  const actor = request.headers.get("x-actor") ?? "unknown";
  const body = (await request.json()) as NewMechanicInput;

  if (!body.name && !body.shopName) {
    return NextResponse.json(
      { error: "name or shopName is required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.phones) || body.phones.length === 0) {
    return NextResponse.json(
      { error: "at least one phone number is required" },
      { status: 400 },
    );
  }
  if (body.onboardingStatus && !ONBOARDING_STATUSES.includes(body.onboardingStatus)) {
    return NextResponse.json({ error: "invalid onboardingStatus" }, { status: 400 });
  }

  const mechanic = await createMechanic(body);

  appendAuditEntry({
    action: "create_mechanic",
    entityType: "mechanic",
    entityId: mechanic.id,
    actor,
    payload: {
      name: mechanic.name,
      shopName: mechanic.shopName,
      phones: mechanic.phones,
      area: mechanic.area,
      services: mechanic.services,
      onboardingStatus: mechanic.onboardingStatus,
    },
    outcome: "success",
  }).catch(() => {});

  return NextResponse.json(mechanic, { status: 201 });
}
