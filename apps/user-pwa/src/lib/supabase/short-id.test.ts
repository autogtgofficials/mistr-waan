import { describe, it, expect } from "vitest";
import { generateShortId, isValidShortId, SHORT_ID_REGEX } from "./short-id";

describe("generateShortId", () => {
  it("produces 9-character strings with AG- prefix", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShortId();
      expect(id).toHaveLength(9);
      expect(id.startsWith("AG-")).toBe(true);
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
    expect(isValidShortId("AG-AB23CD")).toBe(true);
    expect(isValidShortId("AG-PQRSTU")).toBe(true);
  });

  it("rejects ambiguous characters", () => {
    expect(isValidShortId("AG-O00000")).toBe(false);
    expect(isValidShortId("AG-IL1234")).toBe(false);
  });

  it("rejects wrong shape", () => {
    expect(isValidShortId("")).toBe(false);
    expect(isValidShortId("AG-")).toBe(false);
    expect(isValidShortId("AG-ABCDE")).toBe(false);
    expect(isValidShortId("AG-ABCDEFG")).toBe(false);
    expect(isValidShortId("ag-ABCDEF")).toBe(false);
    expect(isValidShortId("AB-CDEFGH")).toBe(false);
  });
});
