import { cookies } from "next/headers";
import type { Locale } from "./dict";

export const LOCALE_COOKIE = "mw_locale";

/**
 * Read the active locale from the cookie. Server-side only.
 * Defaults to "en" when cookie is absent or unrecognised.
 */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const value = c.get(LOCALE_COOKIE)?.value;
  return value === "ur" ? "ur" : "en";
}
