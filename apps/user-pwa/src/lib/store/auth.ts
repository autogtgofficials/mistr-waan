"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side auth hook.
 *
 * Source of truth is the `mw_session` httpOnly cookie set by `/api/auth/otp/verify`.
 * On mount we call `/api/auth/me` to hydrate. `signIn` is a no-op because the
 * server already issued the cookie before we got here — we just re-fetch.
 */

export interface SessionUser {
  id: string;
  phone: string;
  firstName: string;
  language: "en" | "ur";
}

interface MeResponse {
  profile: {
    id: string;
    phone: string;
    firstName: string | null;
    language: string | null;
  };
}

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as MeResponse;
      setUser({
        id: data.profile.id,
        phone: data.profile.phone,
        firstName: data.profile.firstName ?? "User",
        language: (data.profile.language === "ur" ? "ur" : "en") as "en" | "ur",
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /** Compat shim: OtpEntry called `signIn(phone)` after verify. Now a no-op
   *  because /api/auth/otp/verify already set the cookie; we just re-pull. */
  const signIn = useCallback(
    async (_phone: string) => {
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    } catch {
      // best-effort; if network fails the cookie still expires server-side
    }
    setUser(null);
  }, []);

  /** Local-only name update; will be wired to a PATCH /api/auth/me later. */
  const updateName = useCallback((firstName: string) => {
    setUser((prev) => (prev ? { ...prev, firstName } : prev));
  }, []);

  return { user, hydrated, isAuthed: !!user, signIn, signOut, updateName, refresh };
}
