/**
 * Generate a human-friendly short ID for bookings.
 *
 * Format: `MW-XXXXXX` where X is from an unambiguous alphabet
 * (no 0/O/1/I/L) so ops staff can read it back to a customer over the phone.
 *
 * Collision is mathematically possible but vanishingly unlikely at our scale
 * (32^6 = ~1 billion ids; uniqueness is also enforced by `bookings.short_id`
 * unique constraint — caller should retry on conflict).
 */

import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateShortId(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `MW-${suffix}`;
}

export const SHORT_ID_REGEX = /^MW-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function isValidShortId(id: string): boolean {
  return SHORT_ID_REGEX.test(id);
}
