import "server-only";
import { cookies } from "next/headers";
import {
  cookieMaxAgeFor,
  cookieNameFor,
  signSession,
  verifySession,
  type SessionPayload,
  type SessionRole,
} from "./jwt";

/**
 * Set the session cookie for a given role.
 *
 * Cookie attributes:
 *   - httpOnly: true       (JS can't read it)
 *   - sameSite: "lax"      (allows top-level navigation)
 *   - secure: in prod      (Netlify is HTTPS; localhost stays http)
 *   - path: "/"
 *   - domain: undefined    (defaults to the host; override for ops cross-site below)
 *
 * For cross-site cookie sharing across autogtg.com + ops.autogtg.com,
 * pass `crossSubdomain: true` so we set domain = `.autogtg.com`.
 */
export async function setSessionCookie(args: {
  role: SessionRole;
  sub: string;
  phone?: string;
  email?: string;
  crossSubdomain?: boolean;
}): Promise<void> {
  const token = await signSession({
    sub: args.sub,
    role: args.role,
    phone: args.phone,
    email: args.email,
  });
  const cookieStore = await cookies();
  cookieStore.set(cookieNameFor(args.role), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookieMaxAgeFor(args.role),
    domain: args.crossSubdomain ? ".autogtg.com" : undefined,
  });
}

/** Clear a session cookie for a given role (signout).
 *
 * `crossSubdomain` must match what was passed to `setSessionCookie` — browsers
 * key cookies by name+domain+path, so clearing without the domain leaves the
 * cross-subdomain copy alive. Default false (host-only).
 */
export async function clearSessionCookie(
  role: SessionRole,
  { crossSubdomain = false }: { crossSubdomain?: boolean } = {},
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieNameFor(role), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    domain: crossSubdomain ? ".autogtg.com" : undefined,
  });
}

/** Read + verify the cookie for a role; returns null if missing or invalid. */
export async function readSession(role: SessionRole): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieNameFor(role))?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Route-handler helper: require a customer session, return its payload or null.
 * Routes that need it should check for null and return 401.
 */
export async function getCustomerSession(): Promise<SessionPayload | null> {
  return readSession("customer");
}

export async function getGarageSession(): Promise<SessionPayload | null> {
  return readSession("garage");
}

export async function getOpsSession(): Promise<SessionPayload | null> {
  return readSession("ops");
}

/** Convenience JSON 401 response for unauth'd route handlers. */
export function unauthorized(reason = "unauthorized"): Response {
  return Response.json({ error: reason }, { status: 401 });
}
