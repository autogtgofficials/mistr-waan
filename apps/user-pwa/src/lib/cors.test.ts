// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { applyCorsHeaders, handleCorsPreflight } from "./cors";

const ENV_KEY = "ALLOWED_ORIGINS";
const originalEnv = process.env[ENV_KEY];

afterEach(() => {
  if (originalEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalEnv;
});

describe("CORS helpers", () => {
  it("applies headers when origin is the garage subdomain", () => {
    const req = new Request("http://localhost/api/garage/x", {
      headers: { origin: "https://garage.autogtg.com" },
    });
    const res = applyCorsHeaders(NextResponse.json({}), req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://garage.autogtg.com",
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not add headers for an unknown origin", () => {
    const req = new Request("http://localhost/api/garage/x", {
      headers: { origin: "https://evil.example.com" },
    });
    const res = applyCorsHeaders(NextResponse.json({}), req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("accepts origins from ALLOWED_ORIGINS env", () => {
    process.env[ENV_KEY] = "https://staging.garage.autogtg.com";
    const req = new Request("http://localhost/api/garage/x", {
      headers: { origin: "https://staging.garage.autogtg.com" },
    });
    const res = applyCorsHeaders(NextResponse.json({}), req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://staging.garage.autogtg.com",
    );
  });

  it("preflight returns 204 + Allow-Methods for allowed origin", () => {
    const req = new Request("http://localhost/api/garage/x", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3001" },
    });
    const res = handleCorsPreflight(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
  });

  it("preflight returns 403 for disallowed origin", () => {
    const req = new Request("http://localhost/api/garage/x", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example.com" },
    });
    const res = handleCorsPreflight(req);
    expect(res.status).toBe(403);
  });
});
