"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGarageAuth, garageAuth } from "@/lib/store/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";

/**
 * Garage PWA login — real OTP flow via /api/garage/auth/otp/{send,verify}.
 *
 * Send is anti-enumeration: it always returns success even when the phone
 * isn't onboarded, but verify will fail with `phone_not_registered`.
 */
export default function GarageLoginPage() {
  const router = useRouter();
  const { isAuthed, hydrated, refresh } = useGarageAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (hydrated && isAuthed) router.replace("/");
  }, [hydrated, isAuthed, router]);

  const phoneOk = /^[6-9]\d{9}$/.test(phone);

  function handlePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneOk) return;
    setError(null);
    startTransition(async () => {
      try {
        await garageAuth.sendOtp(`+91${phone}`);
        setStep("otp");
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.code === "cooldown"
              ? "Too many requests — wait a moment."
              : "Couldn't send code. Try again."
            : "Network error.",
        );
      }
    });
  }

  function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await garageAuth.verifyOtp({ phone: `+91${phone}`, code: otp });
        await refresh();
        router.replace("/");
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === "phone_not_registered") {
            setError("This phone isn't registered as a garage. Ask ops to onboard you.");
          } else if (err.code === "wrong_code") {
            setError("Wrong code. Try again.");
            setOtp("");
          } else if (err.code === "expired") {
            setError("Code expired. Tap Change to resend.");
          } else {
            setError("Couldn't verify. Try again.");
          }
        } else {
          setError("Network error.");
        }
      }
    });
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-10">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            MW
          </span>
          <span className="text-base font-semibold text-foreground">Mister Waan</span>
          <span className="rounded-full bg-aqua-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aqua-700">
            Garage
          </span>
        </div>

        {step === "phone" ? (
          <form onSubmit={handlePhone}>
            <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the phone number you registered with Mister Waan.
            </p>
            <div className="mt-6 flex items-stretch overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="flex items-center bg-muted px-3 text-base font-medium text-muted-foreground">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="6006617842"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="flex-1 bg-card px-3 py-3 text-base text-foreground tabular outline-none placeholder:text-steel-300"
              />
            </div>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <Button
              type="submit"
              loading={isPending}
              disabled={!phoneOk}
              className="mt-6"
            >
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtp}>
            <h1 className="text-2xl font-bold text-foreground">Enter the code</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="tabular font-medium">+91 {phone}</span>{" "}
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError(null);
                }}
                className="text-primary underline-offset-2 hover:underline"
              >
                Change
              </button>
            </p>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                if (error) setError(null);
              }}
              className="tabular mt-6 w-full rounded-md border border-input bg-card p-3 text-center text-xl font-semibold tracking-widest outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <Button
              type="submit"
              loading={isPending}
              disabled={otp.length !== 6}
              className="mt-6"
            >
              Verify & sign in
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
