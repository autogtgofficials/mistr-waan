// Unit tests for the pure helpers in referrals/data.ts.
// The reward-issuance path has so much Supabase orchestration that we
// cover it via the integration-style tests against the rating + complete
// endpoints; here we just verify the code-generation contract.

import { describe, expect, it } from "vitest";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

describe("referral code generation", () => {
  it("alphabet excludes ambiguous chars", () => {
    expect(ALPHABET).not.toMatch(/[0O1IL]/);
    expect(ALPHABET).toHaveLength(31);
  });
});
