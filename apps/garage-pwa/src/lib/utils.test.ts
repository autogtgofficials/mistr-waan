import { describe, it, expect } from "vitest";
import { cn, formatINR, rupees, ownerLabel, timeAgo, formatHour } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});

describe("formatINR", () => {
  it("formats Indian number grouping", () => {
    expect(formatINR(150000)).toBe("1,50,000");
  });
});

describe("rupees", () => {
  it("prepends rupee symbol", () => {
    expect(rupees(500)).toBe("₹ 500");
  });
});

describe("ownerLabel", () => {
  it("formats as 'First I.'", () => {
    expect(ownerLabel("Tariq", "Mir")).toBe("Tariq M.");
  });

  it("returns first name only when last name empty", () => {
    expect(ownerLabel("Tariq", "")).toBe("Tariq");
  });
});

describe("timeAgo", () => {
  it("returns 'today' for 0 days", () => {
    expect(timeAgo(0)).toBe("today");
  });

  it("returns 'yesterday' for 1 day", () => {
    expect(timeAgo(1)).toBe("yesterday");
  });

  it("returns weeks for 7–29 days", () => {
    expect(timeAgo(14)).toBe("2 weeks ago");
  });
});

describe("formatHour", () => {
  it("converts 24h to AM/PM", () => {
    expect(formatHour("09:00")).toBe("9 AM");
    expect(formatHour("14:00")).toBe("2 PM");
  });

  it("handles noon and midnight", () => {
    expect(formatHour("12:00")).toBe("12 PM");
    expect(formatHour("00:00")).toBe("12 AM");
  });
});
