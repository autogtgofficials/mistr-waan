"use client";

import { useEffect, useState } from "react";
import type { Locale } from "./dict";

const LOCALE_COOKIE = "mw_locale";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/**
 * Reactive locale hook.
 * Mounts with "en" on the server (so SSR + first paint match), then
 * upgrades to the cookie value after hydration. RTL toggling is
 * driven by the server (root layout sets `<html dir>`), so a flash on
 * locale switch is normal and acceptable in V0.
 */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const c = readCookie(LOCALE_COOKIE);
    if (c === "ur") setLocale("ur");
  }, []);

  return locale;
}

/** Write the locale cookie + force a server refresh so RTL/LTR flips. */
export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
}
