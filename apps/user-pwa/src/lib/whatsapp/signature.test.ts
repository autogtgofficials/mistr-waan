import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature } from "./signature";

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyMetaSignature", () => {
  const SECRET = "test-app-secret-32chars-1234567890";
  const BODY = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correctly signed payload", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects when the body has been tampered with", () => {
    const tampered = BODY.replace("[]", '[{"x":1}]');
    expect(verifyMetaSignature(tampered, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects a signature signed with the wrong secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects when the scheme is not sha256", () => {
    const hex = createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyMetaSignature(BODY, `sha1=${hex}`, SECRET)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyMetaSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "garbage", SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "sha256=", SECRET)).toBe(false);
  });

  it("rejects when the app secret is empty", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, SECRET), "")).toBe(false);
  });

  it("rejects a signature of incorrect length without throwing", () => {
    expect(verifyMetaSignature(BODY, "sha256=abc123", SECRET)).toBe(false);
  });
});
