import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay client + signature helpers.
 *
 * We talk to the Orders + Payments REST API directly with HTTP Basic auth
 * (key_id:key_secret) — no SDK dependency. Razorpay's API is stable and
 * the surface we need is tiny (3 endpoints).
 *
 * In dev / when KYC isn't live, set `NEXT_PUBLIC_RAZORPAY_ENABLED=false`
 * and `RAZORPAY_KEY_ID=rzp_test_...`. The customer Pay Now button hides
 * unless the flag is `true`.
 */

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
}

function readConfig(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId) throw new Error("RAZORPAY_KEY_ID not set");
  if (!keySecret) throw new Error("RAZORPAY_KEY_SECRET not set");
  return {
    keyId,
    keySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
  };
}

export function isRazorpayEnabled(): boolean {
  // Server-side check — UI uses NEXT_PUBLIC_RAZORPAY_ENABLED.
  return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
}

/** The public key id, safe to ship to the browser for the Checkout script. */
export function publicKeyId(): string {
  const cfg = readConfig();
  return cfg.keyId;
}

export interface CreateOrderArgs {
  amountRupees: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export async function createOrder(args: CreateOrderArgs): Promise<RazorpayOrder> {
  const cfg = readConfig();
  const res = await fetch(ORDERS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: Math.round(args.amountRupees * 100), // paise
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes ?? {},
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`razorpay order create failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the signature returned by Razorpay Checkout on success.
 *
 * Per Razorpay docs:
 *   payload   = `${order_id}|${payment_id}`
 *   signature = HMAC-SHA256(payload, key_secret)
 */
export function verifyCheckoutSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const cfg = readConfig();
  const payload = `${args.orderId}|${args.paymentId}`;
  const expected = createHmac("sha256", cfg.keySecret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(args.signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Verify webhook signature. Razorpay signs the raw body with the webhook
 * secret (different from key_secret); we compare timing-safe.
 */
export function verifyWebhookSignature(args: {
  rawBody: string;
  signature: string;
}): boolean {
  const cfg = readConfig();
  if (!cfg.webhookSecret) return false; // misconfigured — reject
  const expected = createHmac("sha256", cfg.webhookSecret)
    .update(args.rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(args.signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
