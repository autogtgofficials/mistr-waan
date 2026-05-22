"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Share2, Gift, ArrowLeft } from "lucide-react";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";

interface ReferralPayload {
  referralCode: string;
  loyaltyPoints: number;
  rewardedCount: number;
  shareUrl: string;
}

/**
 * /profile/referrals — share your code, see points + rewards earned.
 *
 * Copy + native-share both supported; falls back to copy if Web Share API
 * isn't available.
 */
export default function ReferralsPage() {
  const [data, setData] = useState<ReferralPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/referral", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setError("Sign in to see your referrals.");
          return;
        }
        if (!res.ok) {
          setError("Couldn't load your referral code.");
          return;
        }
        setData((await res.json()) as ReferralPayload);
      } catch {
        if (!cancelled) setError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function share() {
    if (!data) return;
    if (typeof navigator.share === "function") {
      await navigator.share({
        title: "Mister Waan",
        text: `Get ₹200 off your first car booking on Mister Waan with my code: ${data.referralCode}`,
        url: data.shareUrl,
      });
    } else {
      void copy();
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border-subtle bg-background px-4">
        <Link
          href="/profile"
          aria-label="Back"
          className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </Link>
        <h1 className="text-base font-semibold text-foreground">Refer & earn</h1>
      </header>

      <main className="flex-1 pb-24">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <div className="flex flex-col items-center text-center">
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-full bg-pulse-100 text-pulse-700"
            >
              <Gift className="size-7" strokeWidth={2} />
            </span>
            <h2 className="mt-4 text-2xl font-bold text-foreground">
              Share Mister Waan, get rewarded
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When a friend signs up with your code and completes their first booking,
              you both get 200 loyalty points (₹200 off your next booking).
            </p>
          </div>

          {error ? (
            <p className="mt-6 rounded-md border border-ignite-100 bg-ignite-50 p-3 text-sm text-ignite-900">
              {error}
            </p>
          ) : !data ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <section className="mt-6 rounded-lg border border-border bg-card p-5 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Your code
                </p>
                <p className="mt-2 text-3xl font-mono font-bold tracking-widest text-foreground">
                  {data.referralCode}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={copy} variant="ghost" inline className="flex-1">
                    <Copy className="size-4" strokeWidth={2} />
                    {copied ? "Copied!" : "Copy link"}
                  </Button>
                  <Button onClick={() => void share()} inline className="flex-1">
                    <Share2 className="size-4" strokeWidth={2} />
                    Share
                  </Button>
                </div>
              </section>

              <section className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-card p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Loyalty points
                  </p>
                  <p className="mt-1 tabular text-2xl font-bold text-foreground">
                    {data.loyaltyPoints}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Friends rewarded
                  </p>
                  <p className="mt-1 tabular text-2xl font-bold text-foreground">
                    {data.rewardedCount}
                  </p>
                </div>
              </section>

              <p className="mt-6 text-xs text-muted-foreground">
                Points apply to your next booking automatically — no code needed at checkout.
              </p>
            </>
          )}
        </div>
      </main>

      <TabBar />
    </div>
  );
}
