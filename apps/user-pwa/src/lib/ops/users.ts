import "server-only";
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type OpsUserRow = Database["public"]["Tables"]["ops_users"]["Row"];
type OpsRole = Database["public"]["Enums"]["ops_role"];

/**
 * Ops seat management. Onboarding flow:
 *   1. An existing seat invites a new email → POST /api/ops/invites
 *   2. That email gets a single-use invite token (we display the URL in the
 *      response so ops can hand it off; an email send step would slot in here)
 *   3. Recipient visits /ops/login?invite=<token>
 *   4. They submit (token, shared password) → token is consumed, seat
 *      activated, session cookie set for that email
 *
 * Day-to-day login: email + shared password. The email must exist in
 * ops_users with active=true.
 */

export interface OpsUser {
  id: string;
  email: string;
  role: OpsRole;
  active: boolean;
  inviteToken: string | null;
  invitedBy: string | null;
  inviteAcceptedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

function fromRow(row: OpsUserRow): OpsUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    active: row.active,
    inviteToken: row.invite_token,
    invitedBy: row.invited_by,
    inviteAcceptedAt: row.invite_accepted_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

function normaliseEmail(e: string): string {
  return e.trim().toLowerCase();
}

export async function listOpsUsers(): Promise<OpsUser[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ops_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`ops_users list failed: ${error.message}`);
  return (data ?? []).map(fromRow);
}

export async function findOpsUserByEmail(email: string): Promise<OpsUser | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ops_users")
    .select("*")
    .eq("email", normaliseEmail(email))
    .maybeSingle();
  if (error) throw new Error(`ops_users lookup failed: ${error.message}`);
  return data ? fromRow(data) : null;
}

/**
 * Create an invite for a new email seat. If the email already exists and is
 * active, returns it as-is. If it exists but pending, regenerates the token.
 */
export async function createOpsInvite(opts: {
  email: string;
  role?: OpsRole;
  invitedByOpsUserId: string | null;
}): Promise<OpsUser> {
  const supabase = getSupabaseAdmin();
  const email = normaliseEmail(opts.email);
  const role = opts.role ?? "ops";
  const token = randomBytes(24).toString("base64url");

  const existing = await findOpsUserByEmail(email);
  if (existing && existing.active) {
    // Already accepted; idempotent return.
    return existing;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("ops_users")
      .update({
        invite_token: token,
        invited_by: opts.invitedByOpsUserId,
        role,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`ops invite refresh failed: ${error.message}`);
    return fromRow(data);
  }

  const { data, error } = await supabase
    .from("ops_users")
    .insert({
      email,
      role,
      active: false,
      invite_token: token,
      invited_by: opts.invitedByOpsUserId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`ops invite insert failed: ${error.message}`);
  return fromRow(data);
}

/**
 * Consume an invite token. Verifies the token matches an inactive row,
 * activates the seat, and clears the token. Returns the now-active OpsUser.
 */
export async function acceptOpsInvite(token: string): Promise<OpsUser> {
  if (typeof token !== "string" || token.length < 8) {
    throw new Error("invalid_token");
  }
  const supabase = getSupabaseAdmin();
  const { data: candidate, error: lookupErr } = await supabase
    .from("ops_users")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  if (lookupErr) throw new Error(`invite lookup failed: ${lookupErr.message}`);
  if (!candidate) throw new Error("invite_not_found");

  const { data, error } = await supabase
    .from("ops_users")
    .update({
      active: true,
      invite_token: null,
      invite_accepted_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .select("*")
    .single();
  if (error) throw new Error(`invite accept failed: ${error.message}`);
  return fromRow(data);
}

/** Touch last_login_at when a seat signs in. Best-effort, swallows errors. */
export async function touchOpsLogin(opsUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("ops_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", opsUserId);
}

/**
 * Bootstrap: if there are no ops_users rows yet, create the seed admin
 * the moment someone signs in with the shared password. This avoids a
 * chicken-and-egg where you can't invite yourself.
 */
export async function ensureBootstrapAdmin(email = "ops@autogtg.com"): Promise<OpsUser> {
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("ops_users")
    .select("id", { count: "exact", head: true });
  const existing = await findOpsUserByEmail(email);
  if (existing) return existing;
  // Only bootstrap when there are zero rows — otherwise force the inviter flow.
  if ((count ?? 0) > 0) {
    throw new Error("invite_required");
  }
  const { data, error } = await supabase
    .from("ops_users")
    .insert({
      email: normaliseEmail(email),
      role: "admin",
      active: true,
      invite_accepted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`bootstrap admin failed: ${error.message}`);
  return fromRow(data);
}
