/**
 * Indian phone normalization.
 *
 * The PWA collects 10-digit national numbers (starts 6/7/8/9).
 * Meta Cloud API wants E.164 *without* the leading `+` in the `to` field.
 * We canonicalize to E.164 (`+91...`) internally and strip `+` only at the wire.
 */

const INDIA_CC = "91";
const NATIONAL_RE = /^[6-9]\d{9}$/;

export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  // Strip leading 91 if present (e.g. "+91 60066..." → "9160066..." → "60066...")
  const national =
    digits.length === 12 && digits.startsWith(INDIA_CC)
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  if (!NATIONAL_RE.test(national)) return null;
  return `+${INDIA_CC}${national}`;
}

/** Meta expects the recipient phone without the `+`. */
export function toMetaRecipient(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** Display form: `+91 60066 17842`. */
export function displayIndianPhone(e164: string): string {
  const national = e164.replace(/^\+91/, "");
  if (national.length !== 10) return e164;
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}
