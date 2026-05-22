import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Custom HS256 JWT for our session cookies.
 *
 * Three audiences:
 *   - customer:  sub = profiles.id    cookie name = mw_session
 *   - garage:    sub = garages.id     cookie name = mw_garage_session
 *   - ops:       sub = ops_users.id   cookie name = mw_ops_session
 *
 * 30-day expiry on customer + garage. 12-hour on ops (more sensitive).
 */

export type SessionRole = "customer" | "garage" | "ops";

export interface SessionPayload extends JWTPayload {
  sub: string; // profile/garage/ops_user id
  role: SessionRole;
  phone?: string; // customer + garage only
  email?: string; // ops only
}

const CUSTOMER_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const GARAGE_TTL_SEC = 60 * 60 * 24 * 30;
const OPS_TTL_SEC = 60 * 60 * 12; // 12 hours

const TTL_BY_ROLE: Record<SessionRole, number> = {
  customer: CUSTOMER_TTL_SEC,
  garage: GARAGE_TTL_SEC,
  ops: OPS_TTL_SEC,
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return new TextEncoder().encode(secret);
}

export async function signSession(
  fields: { sub: string; role: SessionRole; phone?: string; email?: string },
  opts: { ttlSec?: number } = {},
): Promise<string> {
  const ttl = opts.ttlSec ?? TTL_BY_ROLE[fields.role];
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: fields.sub,
    role: fields.role,
    iat: now,
    exp: now + ttl,
  };
  if (fields.phone) payload.phone = fields.phone;
  if (fields.email) payload.email = fields.email;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    if (payload.role !== "customer" && payload.role !== "garage" && payload.role !== "ops") return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Cookie name per session role. */
export function cookieNameFor(role: SessionRole): string {
  switch (role) {
    case "customer":
      return "mw_session";
    case "garage":
      return "mw_garage_session";
    case "ops":
      return "mw_ops_session";
  }
}

/** Max-Age for the cookie (matches JWT exp). */
export function cookieMaxAgeFor(role: SessionRole): number {
  return TTL_BY_ROLE[role];
}
