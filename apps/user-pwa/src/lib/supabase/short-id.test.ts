import { describe, it, expect } from "vitest";
import { generateShortId, isValidShortId, SHORT_ID_REGEX } from "./short-id";

describe("generateShortId", () => {
  it("produces 9-character strings with MW- prefix", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShortId();
      expect(id).toHaveLength(9);
      expect(id.startsWith("MW-")).toBe(true);
    }
  });

  it("uses only the unambiguous alphabet (no 0/O/1/I/L)", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShortId();
      expect(id).toMatch(SHORT_ID_REGEX);
    }
  });

  it("never produces duplicates in a small sample (sanity)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(generateShortId());
    // With 31^6 = ~887M possibilities, 200 samples should be unique.
    expect(ids.size).toBe(200);
  });
});

describe("isValidShortId", () => {
  it("accepts well-formed IDs", () => {
    expect(isValidShortId("MW-AB23CD")).toBe(true);
    expect(isValidShortId("MW-PQRSTU")).toBe(true);
  });

  it("rejects ambiguous characters", () => {
    expect(isValidShortId("MW-O00000")).toBe(false);
    expect(isValidShortId("MW-IL1234")).toBe(false);
  });

  it("rejects wrong shape", () => {
    expect(isValidShortId("")).toBe(false);
    expect(isValidShortId("MW-")).toBe(false);
    expect(isValidShortId("MW-ABCDE")).toBe(false);
    expect(isValidShortId("MW-ABCDEFG")).toBe(false);
    expect(isValidShortId("mw-ABCDEF")).toBe(false);
    expect(isValidShortId("AB-CDEFGH")).toBe(false);
  });
});
