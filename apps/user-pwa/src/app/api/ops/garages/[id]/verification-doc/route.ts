import { NextResponse } from "next/server";
import { getOpsSession } from "@/lib/auth/session";
import { getGarageById } from "@/lib/garage/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/ops/garages/[id]/verification-doc
 *
 * Mints a 5-minute signed URL for the garage's verification document
 * (Aadhaar / DL / Shop Reg / GST PDF or image) so the ops UI can preview
 * or download. Ops-only. Returns 404 if the garage has no doc yet.
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
  const garage = await getGarageById(id);
  if (!garage) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!garage.verificationDocPath) {
    return NextResponse.json({ error: "no_doc" }, { status: 404 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from("verification-docs")
    .createSignedUrl(garage.verificationDocPath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "sign_failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: garage.verificationDocPath,
  });
}
