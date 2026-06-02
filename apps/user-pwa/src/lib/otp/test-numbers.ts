import "server-only";

/**
 * Test-number OTP bypass.
 *
 * For phones listed in `OTP_TEST_NUMBERS` (comma-separated, in the same
 * normalised E.164 form the routes use, e.g. `+916006617842`), the OTP is a
 * fixed code (`OTP_TEST_CODE`, default `000000`) and the WhatsApp send is
 * skipped. This lets you sign in for testing/demos without a live, approved
 * WhatsApp template.
 *
 * Only the numbers you explicitly list are affected — everyone else goes
 * through the real random-code + WhatsApp flow. Leave `OTP_TEST_NUMBERS`
 * empty (or unset) to disable the bypass entirely. Keep the list to numbers
 * you control, and don't ship a guessable `OTP_TEST_CODE` in production.
 */
export function testOtpCodeFor(phone: string): string | null {
  const raw = process.env.OTP_TEST_NUMBERS;
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.includes(phone)) return null;
  return process.env.OTP_TEST_CODE || "000000";
}
