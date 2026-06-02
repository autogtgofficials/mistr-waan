// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  isRazorpayEnabled,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "./razorpay";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsecret";
});

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in originalEnv)) delete process.env[k];
  }
  Object.assign(process.env, originalEnv);
});

describe("isRazorpayEnabled", () => {
  it("reads both keys from env", () => {
    expect(isRazorpayEnabled()).toBe(true);
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(isRazorpayEnabled()).toBe(false);
  });
});

describe("verifyCheckoutSignature", () => {
  it("returns true for a correct signature", () => {
    const orderId = "order_test_1";
    const paymentId = "pay_test_1";
    const sig = createHmac("sha256", "secret").update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyCheckoutSignature({ orderId, paymentId, signature: sig })).toBe(true);
  });

  it("returns false for a tampered signature", () => {
    expect(
      verifyCheckoutSignature({
        orderId: "order_test_1",
        paymentId: "pay_test_1",
        signature: "deadbeef".repeat(8),
      }),
    ).toBe(false);
  });

  it("returns false when payment id differs", () => {
    const sig = createHmac("sha256", "secret")
      .update(`order_test_1|pay_test_1`)
      .digest("hex");
    expect(
      verifyCheckoutSignature({
        orderId: "order_test_1",
        paymentId: "pay_test_2",
        signature: sig,
      }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("verifies HMAC over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = createHmac("sha256", "whsecret").update(body).digest("hex");
    expect(verifyWebhookSignature({ rawBody: body, signature: sig })).toBe(true);
  });

  it("rejects when webhook secret missing", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(
      verifyWebhookSignature({ rawBody: "{}", signature: "abc" }),
    ).toBe(false);
  });
});
