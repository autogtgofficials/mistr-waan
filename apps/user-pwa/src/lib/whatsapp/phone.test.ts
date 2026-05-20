import { describe, it, expect } from "vitest";
import { displayIndianPhone, normalizeIndianPhone, toMetaRecipient } from "./phone";

describe("normalizeIndianPhone", () => {
  it("accepts plain 10-digit number starting with 6/7/8/9", () => {
    expect(normalizeIndianPhone("6006617842")).toBe("+916006617842");
    expect(normalizeIndianPhone("9876543210")).toBe("+919876543210");
  });

  it("strips spaces, dashes, and parentheses", () => {
    expect(normalizeIndianPhone("60066 17842")).toBe("+916006617842");
    expect(normalizeIndianPhone("(600) 661-7842")).toBe("+916006617842");
  });

  it("accepts numbers with the +91 country code", () => {
    expect(normalizeIndianPhone("+91 60066 17842")).toBe("+916006617842");
    expect(normalizeIndianPhone("+916006617842")).toBe("+916006617842");
  });

  it("strips a leading 0 trunk prefix", () => {
    expect(normalizeIndianPhone("06006617842")).toBe("+916006617842");
  });

  it("rejects numbers starting with 1-5", () => {
    expect(normalizeIndianPhone("5006617842")).toBeNull();
    expect(normalizeIndianPhone("1234567890")).toBeNull();
  });

  it("rejects wrong-length numbers", () => {
    expect(normalizeIndianPhone("600661784")).toBeNull();
    expect(normalizeIndianPhone("60066178421")).toBeNull();
    expect(normalizeIndianPhone("")).toBeNull();
  });

  it("rejects non-digit junk", () => {
    expect(normalizeIndianPhone("abcdefghij")).toBeNull();
  });
});

describe("toMetaRecipient", () => {
  it("strips the leading +", () => {
    expect(toMetaRecipient("+916006617842")).toBe("916006617842");
  });

  it("leaves a number with no + untouched", () => {
    expect(toMetaRecipient("916006617842")).toBe("916006617842");
  });
});

describe("displayIndianPhone", () => {
  it("formats a canonical E.164 Indian number with a space group", () => {
    expect(displayIndianPhone("+916006617842")).toBe("+91 60066 17842");
  });

  it("returns input unchanged when not a 10-digit national part", () => {
    expect(displayIndianPhone("+1234")).toBe("+1234");
  });
});
