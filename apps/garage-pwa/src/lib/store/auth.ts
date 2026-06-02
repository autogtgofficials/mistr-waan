"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { GarageInfo } from "@/lib/api/types";

/**
 * Real garage auth — backed by `/api/garage/auth/*` on user-pwa.
 *
 * Session cookie (`mw_garage_session`) is set with `domain=.autogtg.com`
 * by the verify endpoint, so the cookie travels across garage.autogtg.com ↔
 * autogtg.com. In dev this works against localhost too — the cookie is set
 * on the host that issued it (no domain attribute).
 *
 * `signIn` is a two-step flow now: phone → verify. The component does the
 * sending; this hook just owns the post-verify state.
 */

export interface GarageUser extends GarageInfo {
  phone: string;
}

export function useGarageAuth() {
  const [user, setUser] = useState<GarageUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data = await api.get<{ garage: GarageInfo & { phone: string } }>(
        "/api/garage/auth/me",
      );
      setUser({
        id: data.garage.id,
        shopName: data.garage.shopName,
        ownerFirstName: data.garage.ownerFirstName,
        area: data.garage.area,
        phone: data.garage.phone,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        // Other errors leave user as-is; UI keeps any cached state.
        console.warn("[garage auth] refresh failed", err);
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/garage/auth/signout");
    } catch {
      // ignore — we still null the local state
    }
    setUser(null);
  }, []);

  return {
    user,
    hydrated,
    isAuthed: !!user,
    refresh,
    signOut,
  };
}

/** Two-step OTP send/verify, used by the login page. */
export const garageAuth = {
  async sendOtp(phone: string): Promise<{ sent: true; expiresAt?: string }> {
    return api.post<{ sent: true; expiresAt?: string }>("/api/garage/auth/otp/send", {
      phone,
    });
  },
  async verifyOtp(args: {
    phone: string;
    code: string;
  }): Promise<{ verified: true; garage: GarageInfo }> {
    return api.post<{ verified: true; garage: GarageInfo }>(
      "/api/garage/auth/otp/verify",
      args,
    );
  },
};
