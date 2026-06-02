// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearWizardState,
  getWizardState,
  setWizardState,
  type WizardState,
} from "./state";

let tmp: string;
const cwdAtStart = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "wizstate-"));
  process.chdir(tmp);
});
afterEach(() => {
  process.chdir(cwdAtStart);
  rmSync(tmp, { recursive: true, force: true });
});

const baseState: WizardState = {
  phone: "+916006617842",
  step: "PICKING_BUCKET",
  updatedAt: Date.now(),
};

describe("wizard state store", () => {
  it("returns null when no state exists", async () => {
    expect(await getWizardState("+919000000000")).toBeNull();
  });

  it("round-trips set → get", async () => {
    await setWizardState({ ...baseState });
    const got = await getWizardState("+916006617842");
    expect(got?.step).toBe("PICKING_BUCKET");
    expect(got?.phone).toBe("+916006617842");
  });

  it("clear removes the state", async () => {
    await setWizardState({ ...baseState });
    await clearWizardState("+916006617842");
    expect(await getWizardState("+916006617842")).toBeNull();
  });

  it("stamps updatedAt on every set", async () => {
    const before = Date.now();
    await setWizardState({ ...baseState, updatedAt: 0 });
    const got = await getWizardState("+916006617842");
    expect(got?.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("expires sessions older than TTL", async () => {
    // Manually plant an aged state via the FS path.
    const aged: WizardState = {
      ...baseState,
      updatedAt: Date.now() - 40 * 60 * 1000, // 40 min ago — past TTL
    };
    // setWizardState would refresh updatedAt; bypass it by writing directly.
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir("data", { recursive: true });
    await writeFile(
      "data/bot-state.json",
      JSON.stringify({ [aged.phone]: aged }),
    );
    expect(await getWizardState(aged.phone)).toBeNull();
  });

  it("keeps independent state per phone", async () => {
    await setWizardState({ ...baseState, phone: "+91A" });
    await setWizardState({ ...baseState, phone: "+91B", step: "PICKING_SLOT" });
    expect((await getWizardState("+91A"))?.step).toBe("PICKING_BUCKET");
    expect((await getWizardState("+91B"))?.step).toBe("PICKING_SLOT");
  });
});
