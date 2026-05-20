import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Meta webhook payload against the `X-Hub-Signature-256` header.
 * Header format: `sha256=<hex>`. The signature is HMAC-SHA256 of the raw
 * request body using the app secret as the key.
 *
 * Returns false on any malformed input — never throws.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  // timingSafeEqual requires equal-length buffers — bail before it throws.
  if (providedHex.length !== expectedHex.length) return false;

  try {
    return timingSafeEqual(Buffer.from(providedHex, "hex"), Buffer.from(expectedHex, "hex"));
  } catch {
    return false;
  }
}
