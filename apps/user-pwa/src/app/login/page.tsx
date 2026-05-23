"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { PhoneEntry } from "@/components/auth/PhoneEntry";
import { OtpEntry } from "@/components/auth/OtpEntry";
import { useAuth } from "@/lib/store/auth";

/**
 * /login — full-screen phone OTP wall.
 *
 * Reached when user taps "Continue to pay" without being signed in.
 * After verification, navigates to ?next= or "/" if no next.
 */

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  // ?ref=XYZ123 — referral code carried in from a shared link. We capture
  // it before sign-in and POST to /api/me/referral/claim after the session
  // cookie is set. Silently ignores failures.
  const refCode = searchParams.get("ref");
  const { signIn } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");

  async function handleVerified() {
    // /api/auth/otp/verify already set the mw_session cookie.
    // signIn just refreshes the in-memory profile from /api/auth/me.
    await signIn(phone);
    if (refCode) {
      try {
        await fetch("/api/me/referral/claim", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: refCode }),
        });
      } catch {
        // ignore — referral is optional and silently no-ops if already claimed
      }
    }
    router.replace(next);
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex h-14 items-center px-4">
        {step === "phone" ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Back"
          >
            <X className="size-5 rotate-45" strokeWidth={2} />
          </button>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4 pb-10">
        {step === "phone" ? (
          <PhoneEntry
            onCodeSent={(p, c) => {
              setPhone(p);
              setChannel(c);
              setStep("otp");
            }}
          />
        ) : (
          <OtpEntry
            phone={phone}
            channel={channel}
            onChange={() => setStep("phone")}
            onSwitchChannel={(c) => setChannel(c)}
            onVerified={handleVerified}
          />
        )}
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full" />}>
      <LoginInner />
    </Suspense>
  );
}
