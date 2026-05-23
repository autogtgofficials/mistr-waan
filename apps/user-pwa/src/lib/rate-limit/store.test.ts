// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rateLimit } from "./store";

let tmp: string;
const cwdAtStart = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ratelimit-"));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(cwdAtStart);
  rmSync(tmp, { recursive: true, force: true });
});

describe("rateLimit", () => {
  it("allows the first N hits, blocks the (N+1)th", async () => {
    const opts = { max: 3, windowMs: 60_000 };
    expect((await rateLimit("k1", opts)).ok).toBe(true);
    expect((await rateLimit("k1", opts)).ok).toBe(true);
    expect((await rateLimit("k1", opts)).ok).toBe(true);
    const blocked = await rateLimit("k1", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("uses an independent counter per key", async () => {
    const opts = { max: 1, windowMs: 60_000 };
    expect((await rateLimit("a", opts)).ok).toBe(true);
    expect((await rateLimit("b", opts)).ok).toBe(true);
    expect((await rateLimit("a", opts)).ok).toBe(false);
    expect((await rateLimit("b", opts)).ok).toBe(false);
  });

  it("recovers after the window elapses", async () => {
    const opts = { max: 1, windowMs: 10 };
    expect((await rateLimit("k2", opts)).ok).toBe(true);
    expect((await rateLimit("k2", opts)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect((await rateLimit("k2", opts)).ok).toBe(true);
  });
});
