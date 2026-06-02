"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Razorpay "Pay now" button for a UPI booking in `quoted` status.
 *
 * Lazy-loads the Checkout script on first mount of the button so the JS isn't
 * shipped to every page in the app. After a successful payment the parent
 * passes a callback that refetches the booking + payment from the API.
 */

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open(): void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (resp: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

async function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script_failed")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script_failed"));
    document.head.appendChild(s);
  });
}

export function PayNowButton(props: {
  bookingId: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warm the script when the button mounts — the user is likely to tap soon.
  useEffect(() => {
    void loadCheckoutScript().catch(() => undefined);
  }, []);

  async function handlePay() {
    setBusy(true);
    setError(null);
    try {
      await loadCheckoutScript();
      if (!window.Razorpay) throw new Error("Checkout failed to load. Refresh and retry.");

      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: props.bookingId }),
      });
      const orderData = (await res.json()) as {
        orderId?: string;
        keyId?: string;
        amountPaise?: number;
        currency?: string;
        shortId?: string;
        error?: string;
      };
      if (!res.ok || !orderData.orderId) {
        throw new Error(orderData.error ?? `HTTP ${res.status}`);
      }

      // openCheckout returns when the modal closes. The `handler` callback is
      // the success path; we resolve via a deferred promise so we can await it.
      let resolveDone!: () => void;
      let rejectDone!: (e: Error) => void;
      const done = new Promise<void>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
      });

      const checkout = new window.Razorpay({
        key: orderData.keyId!,
        amount: orderData.amountPaise!,
        currency: orderData.currency!,
        order_id: orderData.orderId!,
        name: "AutoGTG",
        description: `Booking ${orderData.shortId}`,
        prefill: {
          name: props.customerName,
          contact: props.customerPhone,
        },
        theme: { color: "#3949ab" },
        handler: async (resp) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              }),
            });
            const data = (await verifyRes.json()) as { captured?: boolean; error?: string };
            if (!verifyRes.ok || !data.captured) {
              rejectDone(new Error(data.error ?? `verify HTTP ${verifyRes.status}`));
              return;
            }
            props.onSuccess?.();
            resolveDone();
          } catch (e) {
            rejectDone(e instanceof Error ? e : new Error("verify_failed"));
          }
        },
      });
      checkout.open();
      await done;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={() => void handlePay()} loading={busy} className="w-full">
        Pay ₹{props.amount} via UPI
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Secure UPI via Razorpay. Money is held until your job is confirmed.
        </p>
      )}
    </div>
  );
}
