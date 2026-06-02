import { describe, it, expect, afterEach } from "vitest";
import { testOtpCodeFor } from "./test-numbers";

const ORIG_NUMBERS = process.env.OTP_TEST_NUMBERS;
const ORIG_CODE = process.env.OTP_TEST_CODE;

afterEach(() => {
  if (ORIG_NUMBERS === undefined) delete process.env.OTP_TEST_NUMBERS;
  else process.env.OTP_TEST_NUMBERS = ORIG_NUMBERS;
  if (ORIG_CODE === undefined) delete process.env.OTP_TEST_CODE;
  else process.env.OTP_TEST_CODE = ORIG_CODE;
});

describe("testOtpCodeFor", () => {
  it("returns null when OTP_TEST_NUMBERS is unset (bypass disabled)", () => {
    delete process.env.OTP_TEST_NUMBERS;
    expect(testOtpCodeFor("+916006617842")).toBeNull();
  });

  it("returns the configured fixed code for a listed number", () => {
    process.env.OTP_TEST_NUMBERS = "+916006617842, +919999999999";
    process.env.OTP_TEST_CODE = "424242";
    expect(testOtpCodeFor("+916006617842")).toBe("424242");
    expect(testOtpCodeFor("+919999999999")).toBe("424242");
  });

  it("defaults the code to 000000 when OTP_TEST_CODE is unset", () => {
    process.env.OTP_TEST_NUMBERS = "+916006617842";
    delete process.env.OTP_TEST_CODE;
    expect(testOtpCodeFor("+916006617842")).toBe("000000");
  });

  it("returns null for a number not in the list", () => {
    process.env.OTP_TEST_NUMBERS = "+916006617842";
    expect(testOtpCodeFor("+910000000000")).toBeNull();
  });
});
