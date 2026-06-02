import "server-only";
import { NextResponse } from "next/server";

/**
 * CORS for the cross-subdomain garage PWA (garage.autogtg.com → autogtg.com)
 * and any other allowlisted origin we add later (e.g. ops.autogtg.com if we
 * ever split it out).
 *
 * The allowlist is configured via env var `ALLOWED_ORIGINS` (comma-separated).
 * In dev we accept localhost:3001 for the garage app. Wildcards are NOT used
 * because we want `Access-Control-Allow-Credentials: true` and the browser
 * rejects wildcard+credentials.
 */

const DEFAULT_ORIGINS = [
  "https://garage.autogtg.com",
  "https://autogtg.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

function allowedOrigins(): Set<string> {
  const envList = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...envList]);
}

/** Pick the origin if it's allowed, otherwise return null. */
function pickOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return allowedOrigins().has(origin) ? origin : null;
}

/** Apply CORS headers to an existing response (mutates and returns). */
export function applyCorsHeaders(response: NextResponse, request: Request): NextResponse {
  const origin = pickOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

/** Handle the CORS preflight (OPTIONS) for an allowed origin. */
export function handleCorsPreflight(request: Request): NextResponse {
  const origin = pickOrigin(request);
  if (!origin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Actor",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}
