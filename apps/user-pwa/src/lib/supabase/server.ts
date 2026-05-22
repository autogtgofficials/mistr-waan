import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-only Supabase client using the service-role key.
 *
 * IMPORTANT — never import this from a client component. Server-side only.
 * The service-role key bypasses RLS, so we wrap it behind every route handler
 * with explicit authz checks (see `@/lib/auth/session`).
 *
 * Returns a fresh client per call. Supabase-js's client is cheap to construct
 * and there's no connection pool to share at this layer (PostgREST is HTTP).
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient<Database>(url, serviceKey, {
    auth: {
      // We don't use Supabase Auth — our custom JWT lives in mw_session cookie.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
