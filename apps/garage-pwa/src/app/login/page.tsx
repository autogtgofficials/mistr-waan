"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGarageAuth } from "@/lib/store/auth";
import { Button } from "@/components/ui/Button";

/**
 * Garage PWA login — same-shape OTP flow as user-pwa, simpler V0 demo.
 *
 * Mock: any 10-digit phone + any 6-digit OTP (except "000000") signs in
 * as the demo garage owner.
 */
export default function GarageLoginPage() {
  const router = useRouter();
  const { signIn, isAuthed, hydrated } = useGarageAuth();
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
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 600));
      setStep("otp");
    });
  }

  function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 700));
      if (otp === "000000") {
        setError("Wrong code. Try again.");
        setOtp("");
        return;
      }
      signIn(`+91 ${phone}`);
      router.replace("/");
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
            <Button
              type="submit"
              loading={isPending}
              disabled={!phoneOk}
              className="mt-6"
            >
              Send code
            </Button>
            <p className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <span className="font-semibold">Mock V0:</span> any valid 10-digit Indian
              mobile signs in as &quot;Imran K. — Khan Auto Detailing&quot;.
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtp}>
            <h1 className="text-2xl font-bold text-foreground">Enter the code</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="tabular font-medium">+91 {phone}</span>{" "}
              <button
                type="button"
                onClick={() => setStep("phone")}
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
            <p className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Any 6 digits work. Try{" "}
              <span className="font-mono">000000</span> for the wrong-code state.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
