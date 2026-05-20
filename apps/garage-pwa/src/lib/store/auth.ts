"use client";

import { useCallback, useEffect, useState } from "react";

export interface GarageUser {
  phone: string;
  garageId: string;
}

const KEY = "mw_garage_user";

function read(): GarageUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GarageUser;
  } catch {
    return null;
  }
}

export function useGarageAuth() {
  const [user, setUser] = useState<GarageUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(read());
    setHydrated(true);
  }, []);

  const signIn = useCallback((phone: string) => {
    /* V0 mock: any phone signs in as the demo garage owner. */
    const u: GarageUser = { phone, garageId: "g-imran-k" };
    sessionStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setUser(null);
  }, []);

  return { user, hydrated, isAuthed: !!user, signIn, signOut };
}
