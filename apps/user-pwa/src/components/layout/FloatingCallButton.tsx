"use client";

import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+917889686682";

/**
 * Persistent round "Call us" button, bottom-right on customer screens.
 *
 * The call-back model is phone-first, so a one-tap call is always within reach.
 * Hidden on the ops panel, auth, and the booking flow (which has its own sticky
 * CTAs) to avoid overlap.
 */
// Hidden where there's a sticky bottom CTA (would overlap) or its own call
// action: the ops panel, auth, the booking flow, garage detail, and the
// services catalog (which has its own "Call us" button).
const HIDE_PREFIXES = ["/ops", "/login", "/booking", "/garages", "/services"];

export function FloatingCallButton() {
  const pathname = usePathname() ?? "/";
  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const dial = SUPPORT_PHONE.replace(/\s+/g, "");

  return (
    <a
      href={`tel:${dial}`}
      aria-label="Call AutoGTG"
      className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/15 transition-transform active:scale-95"
    >
      <Phone className="size-6" strokeWidth={2.25} />
    </a>
  );
}
