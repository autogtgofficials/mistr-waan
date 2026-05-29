import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate } from "./templates";

describe("WhatsApp template registry", () => {
  it("contains all 15 templates (Weeks 1-4 + Phase 5 blueprint)", () => {
    const names = Object.keys(TEMPLATES).sort();
    expect(names).toEqual(
      [
        // Weeks 1-4
        "booking_cancelled",
        "booking_confirmed",
        "booking_quoted",
        "garage_declined",
        "garage_new_job",
        "job_complete",
        "job_started",
        "mechanic_assigned",
        "otp_login",
        "referral_reward",
        // Phase 5 — blueprint alignment
        "mechanic_activated",
        "mechanic_onboarding_submitted",
        "mechanic_rejected",
        "request_photos",
        "rsa_acknowledged",
      ].sort(),
    );
  });

  it("garage_new_job declares 4 vars + 2 quick-reply buttons", () => {
    const t = getTemplate("garage_new_job");
    expect(t.variableCount).toBe(4);
    expect(t.buttonCount).toBe(2);
    expect(t.category).toBe("utility");
  });

  it("booking_quoted declares 3 vars", () => {
    expect(getTemplate("booking_quoted").variableCount).toBe(3);
  });

  it("referral_reward is marketing category", () => {
    expect(getTemplate("referral_reward").category).toBe("marketing");
  });
});
