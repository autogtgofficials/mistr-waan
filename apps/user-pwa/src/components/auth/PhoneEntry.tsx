"use client";

import { useState, useTransition } from "react";

export interface PhoneEntryProps {
  onCodeSent: (phone: string, channel: "whatsapp" | "sms") => void;
}

export function PhoneEntry({ onCodeSent }: PhoneEntryProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isValid = /^[6-9]\d{9}$/.test(phone);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError("Please enter a valid Indian mobile number.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: "whatsapp" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; retryAfterMs?: number };
        if (data.error === "cooldown" && data.retryAfterMs) {
          const seconds = Math.ceil(data.retryAfterMs / 1000);
          setError(`Please wait ${seconds}s before requesting another code.`);
        } else if (data.error === "invalid_phone") {
          setError("Please enter a valid Indian mobile number.");
        } else {
          setError("Couldn't send WhatsApp code. Please try again.");
        }
        return;
      }
      onCodeSent(`+91 ${phone}`, "whatsapp");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <h1 className="text-2xl font-bold text-foreground">Almost done.</h1>
      <p className="mt-2 text-base text-foreground">What&apos;s your phone number?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll send a 6-digit code via WhatsApp.
      </p>

      <div className="mt-8 flex items-stretch overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <span className="flex items-center bg-muted px-3 text-base font-medium text-muted-foreground">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          placeholder="6006617842"
          value={phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(digits);
            if (error) setError(null);
          }}
          className="flex-1 bg-card px-3 py-3 text-base text-foreground tabular outline-none placeholder:text-steel-300"
          aria-invalid={!!error}
          aria-describedby={error ? "phone-error" : undefined}
        />
      </div>
      {error ? (
        <p id="phone-error" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!isValid || isPending}
        className="mt-8 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.99] disabled:bg-muted disabled:text-muted-foreground"
        aria-busy={isPending}
      >
        {isPending ? "Sending…" : "Send code →"}
      </button>

      <p className="mt-4 text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <a href="#" className="text-primary underline-offset-2 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="text-primary underline-offset-2 hover:underline">
          Privacy
        </a>
        .
      </p>
    </form>
  );
}
