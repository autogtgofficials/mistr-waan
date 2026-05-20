import { describe, it, expect } from "vitest";
import { cn, formatINR, rupees, ownerLabel, timeAgo, formatHour } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("filters falsy values", () => {
    expect(cn("base", false && "skip", undefined)).toBe("base");
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
    expect(ownerLabel("Imran", "Khan")).toBe("Imran K.");
  });

  it("returns first name only when last name empty", () => {
    expect(ownerLabel("Imran", "")).toBe("Imran");
  });
});

describe("timeAgo", () => {
  it("returns 'today' for 0 days", () => {
    expect(timeAgo(0)).toBe("today");
  });

  it("returns 'yesterday' for 1 day", () => {
    expect(timeAgo(1)).toBe("yesterday");
  });

  it("returns days for 2–6", () => {
    expect(timeAgo(3)).toBe("3 days ago");
  });

  it("returns weeks for 7–29", () => {
    expect(timeAgo(7)).toBe("1 weeks ago");
  });

  it("returns months for 30–364", () => {
    expect(timeAgo(60)).toBe("2 months ago");
  });

  it("returns years for 365+", () => {
    expect(timeAgo(730)).toBe("2 years ago");
  });
});

describe("formatHour", () => {
  it("converts 24h to AM/PM", () => {
    expect(formatHour("09:00")).toBe("9 AM");
    expect(formatHour("16:00")).toBe("4 PM");
  });

  it("handles noon", () => {
    expect(formatHour("12:00")).toBe("12 PM");
  });

  it("handles midnight", () => {
    expect(formatHour("00:00")).toBe("12 AM");
  });
});
