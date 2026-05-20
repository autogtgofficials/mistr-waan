import { NextResponse } from "next/server";
import { getAuditEntries } from "@/lib/audit/log";

// Gated behind AUDIT_SECRET until real session auth lands.
// Set AUDIT_SECRET=<random string> in Netlify env vars and pass it as
// the "x-audit-secret" request header (or Authorization: Bearer <secret>).
// TODO: replace with session-based admin check when auth is implemented.
function isAuthorized(request: Request): boolean {
  const secret = process.env.AUDIT_SECRET;
  if (!secret) return false; // no secret configured = deny all
  const header =
    request.headers.get("x-audit-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 1000);
  const entries = await getAuditEntries(limit);
  return NextResponse.json({ entries, count: entries.length });
}
