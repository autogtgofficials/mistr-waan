"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OpsLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/ops/bookings";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ops/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 401) setError("Wrong password.");
          else if (data.error === "invite_pending")
            setError("Your invite hasn't been accepted yet — ask an admin to resend.");
          else if (data.error === "invite_required")
            setError("This email isn't invited yet. Ask an admin to add you.");
          else if (data.error === "invalid_email") setError("Enter a valid email.");
          else setError("Something went wrong. Try again.");
          return;
        }
        router.replace(next);
      } catch {
        setError("Network problem. Try again.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-foreground">Ops dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email + shared password. Invite-only.
        </p>

        <label className="mt-6 block text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-invalid={!!error}
          aria-describedby={error ? "ops-login-error" : undefined}
        />

        {error ? (
          <p
            id="ops-login-error"
            role="alert"
            className="mt-3 rounded-md border border-danger/30 bg-danger/5 p-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!email || !password || isPending}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:bg-muted disabled:text-muted-foreground"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
