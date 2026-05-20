"use client";

import { useEffect, useRef, useState, useTransition } from "react";

export interface OtpEntryProps {
  phone: string;
  channel: "whatsapp" | "sms";
  onChange?: () => void;
  /** Switch channel (e.g. WhatsApp → SMS). */
  onSwitchChannel: (channel: "whatsapp" | "sms") => void;
  onVerified: () => void;
}

/** Strip the "+91 " display prefix so we send the raw 10-digit national number to the API. */
function stripIndianPrefix(display: string): string {
  return display.replace(/^\+91\s*/, "").replace(/\s+/g, "");
}

const LENGTH = 6;
const RESEND_COOLDOWN = 60;

export function OtpEntry({
  phone,
  channel,
  onChange,
  onSwitchChannel,
  onVerified,
}: OtpEntryProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [isPending, startTransition] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  /* Cooldown countdown */
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  /* Focus first input on mount */
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setDigit(i: number, value: string) {
    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function handleInput(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigit(i, digit);

    /* Advance focus + auto-submit */
    if (digit && i < LENGTH - 1) {
      refs.current[i + 1]?.focus();
    } else if (digit && i === LENGTH - 1) {
      const code = [...digits.slice(0, i), digit].join("");
      submit(code);
    }
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setDigit(i - 1, "");
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.padEnd(LENGTH, "").split("");
    setDigits(next);
    if (pasted.length === LENGTH) submit(pasted);
    else refs.current[pasted.length]?.focus();
  }

  function submit(code: string) {
    if (code.length !== LENGTH) return;
    startTransition(async () => {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: stripIndianPrefix(phone), code }),
      });
      if (res.ok) {
        onVerified();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        attemptsRemaining?: number;
      };
      const message =
        data.error === "wrong_code" && typeof data.attemptsRemaining === "number"
          ? `Wrong code. ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? "" : "s"} left.`
          : data.error === "expired"
            ? "Code expired. Tap Resend code."
            : data.error === "too_many_attempts"
              ? "Too many attempts. Tap Resend code."
              : data.error === "not_found"
                ? "No code on file. Tap Resend code."
                : "Wrong code. Try again.";
      setError(message);
      setDigits(Array(LENGTH).fill(""));
      refs.current[0]?.focus();
    });
  }

  function resend() {
    setError(null);
    setDigits(Array(LENGTH).fill(""));
    setCooldown(RESEND_COOLDOWN);
    refs.current[0]?.focus();
    void fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: stripIndianPrefix(phone), channel }),
    }).then(async (r) => {
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string; retryAfterMs?: number };
        if (data.error === "cooldown" && data.retryAfterMs) {
          setError(`Please wait ${Math.ceil(data.retryAfterMs / 1000)}s before retrying.`);
        } else {
          setError("Couldn't resend code. Try again in a moment.");
        }
      }
    });
  }

  const switchTo = channel === "whatsapp" ? "sms" : "whatsapp";

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl font-bold text-foreground">
        Check {channel === "whatsapp" ? "WhatsApp" : "your messages"}.
      </h1>
      <p className="mt-2 text-base text-foreground">
        We sent a 6-digit code to <span className="font-medium tabular">{phone}</span>{" "}
        <button
          type="button"
          onClick={onChange}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Change
        </button>
      </p>

      <div className="mt-8 flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="tel"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={isPending}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={!!error}
            className={`tabular flex h-14 w-12 items-center justify-center rounded-md border bg-card text-center text-xl font-semibold tracking-wider text-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
              error ? "border-danger" : "border-input"
            }`}
          />
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Verifying…</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 text-sm">
        {cooldown > 0 ? (
          <span className="text-muted-foreground">
            Resend code (00:{cooldown.toString().padStart(2, "0")})
          </span>
        ) : (
          <button
            type="button"
            onClick={resend}
            className="self-start text-primary font-medium underline-offset-2 hover:underline"
          >
            Resend code
          </button>
        )}
        <button
          type="button"
          onClick={() => onSwitchChannel(switchTo)}
          className="self-start text-primary font-medium underline-offset-2 hover:underline"
        >
          {switchTo === "sms" ? "Try SMS instead" : "Try WhatsApp instead"}
        </button>
      </div>

    </div>
  );
}
