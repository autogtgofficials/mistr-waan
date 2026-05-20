"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Mock auth — V0 only. Stores a "logged in" user in sessionStorage.
 * Real auth lands when Django + JWT lands.
 */

export interface MockUser {
  phone: string; // e.g. "+91 6006617842"
  firstName: string; // default "User" — prompted in profile
  language: "en" | "ur";
}

const KEY = "mw_mock_user";

export function readUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockUser;
  } catch {
    return null;
  }
}

export function writeUser(user: MockUser) {
  sessionStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser() {
  sessionStorage.removeItem(KEY);
}

export function useAuth() {
  const [user, setUser] = useState<MockUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(readUser());
    setHydrated(true);

    /* Sync across tabs / sheet-driven sign-ins */
    function handleStorage(e: StorageEvent) {
      if (e.key === KEY) setUser(readUser());
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const signIn = useCallback((phone: string) => {
    const u: MockUser = { phone, firstName: "User", language: "en" };
    writeUser(u);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(() => {
    clearUser();
    setUser(null);
  }, []);

  const updateName = useCallback((firstName: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, firstName };
      writeUser(next);
      return next;
    });
  }, []);

  return { user, hydrated, isAuthed: !!user, signIn, signOut, updateName };
}
