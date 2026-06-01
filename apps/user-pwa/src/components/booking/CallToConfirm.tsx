"use client";

import { Phone } from "lucide-react";

/**
 * Call-first booking CTA. The blueprint's model: the customer browses
 * without logging in, taps "Call to confirm", and talks to ops — who
 * confirms the mechanic and creates the booking. Payment happens later,
 * after the call, once the customer logs in to track their booking.
 *
 * No login, no payment, no form here — just a tel: link to the support
 * line (NEXT_PUBLIC_SUPPORT_PHONE).
 */
export function CallToConfirm({
  serviceLabel,
  className,
}: {
  serviceLabel?: string;
  className?: string;
}) {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "+917889686682";
  // tel: needs the bare digits with +; strip spaces just in case.
  const dial = phone.replace(/\s+/g, "");

  return (
    <div className={className}>
      <a
        href={`tel:${dial}`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        <Phone className="size-5" strokeWidth={2} />
        {serviceLabel ? `Call to book ${serviceLabel}` : "Call to confirm"}
      </a>
      <p className="mt-3 rounded-md bg-muted/50 p-3 text-center text-xs text-muted-foreground">
        We&apos;ll confirm your mechanic on the call and lock the price. No
        payment now — you pay after we confirm. No login needed to book.
      </p>
    </div>
  );
}
