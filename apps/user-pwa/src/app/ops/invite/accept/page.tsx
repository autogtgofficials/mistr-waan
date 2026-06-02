"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AcceptInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "accepted" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Missing invite token.");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ops/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { email?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.email) {
          setState("error");
          setError(data.error ?? "Couldn't accept invite.");
          return;
        }
        setEmail(data.email);
        setState("accepted");
      } catch {
        if (!cancelled) {
          setState("error");
          setError("Network error.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">Ops invite</h1>
        {state === "loading" ? (
          <p className="mt-2 text-sm text-muted-foreground">Accepting…</p>
        ) : state === "accepted" ? (
          <>
            <p className="mt-2 text-sm text-foreground">
              Seat activated for <span className="font-semibold">{email}</span>.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in with the team password to get started.
            </p>
            <Link
              href="/ops/login"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground"
            >
              Continue to login
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-danger">{error}</p>
            <Link
              href="/ops/login"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md border border-border text-base font-semibold text-foreground"
            >
              Go to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function OpsAcceptInvitePage() {
  return (
    <Suspense fallback={<div />}>
      <AcceptInner />
    </Suspense>
  );
}
