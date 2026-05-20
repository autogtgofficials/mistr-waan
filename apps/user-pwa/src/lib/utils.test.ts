import { describe, it, expect } from "vitest";
import {
  cn,
  formatINR,
  rupees,
  ownerLabel,
  approxKm,
  timeAgo,
  jobsDoneLabel,
} from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("filters falsy values", () => {
    expect(cn("base", false && "skipped", undefined, "end")).toBe("base end");
  });
});

describe("formatINR", () => {
  it("formats under 1000 with no separators", () => {
    expect(formatINR(150)).toBe("150");
  });

  it("formats thousands", () => {
    expect(formatINR(15500)).toBe("15,500");
  });

  it("formats lakhs with Indian grouping", () => {
    expect(formatINR(150000)).toBe("1,50,000");
  });

  it("formats crores", () => {
    expect(formatINR(10000000)).toBe("1,00,00,000");
  });
});

describe("rupees", () => {
  it("prepends rupee symbol", () => {
    expect(rupees(500)).toMatch(/₹.500/);
  });
});

describe("ownerLabel", () => {
  it("formats as 'First I.'", () => {
    expect(ownerLabel("Imran", "Khan")).toBe("Imran K.");
  });

  it("returns only first name when last name is empty", () => {
    expect(ownerLabel("Imran", "")).toBe("Imran");
  });

  it("uppercases the initial", () => {
    expect(ownerLabel("Ali", "bhat")).toBe("Ali B.");
  });
});

describe("approxKm", () => {
  it("returns at least 1 km for sub-km distances", () => {
    expect(approxKm(0.3)).toBe("~1 km");
  });

  it("rounds km values", () => {
    expect(approxKm(3.4)).toBe("~3 km");
    expect(approxKm(3.7)).toBe("~4 km");
  });

  it("handles exactly 1 km", () => {
    expect(approxKm(1)).toBe("~1 km");
  });
});

describe("timeAgo", () => {
  it("returns 'today' for 0 days", () => {
    expect(timeAgo(0)).toBe("today");
  });

  it("returns 'yesterday' for 1 day", () => {
    expect(timeAgo(1)).toBe("yesterday");
  });

  it("returns days for < 7", () => {
    expect(timeAgo(5)).toBe("5 days ago");
  });

  it("returns '1 week ago' for 7–13 days", () => {
    expect(timeAgo(7)).toBe("1 week ago");
    expect(timeAgo(13)).toBe("1 week ago");
  });

  it("returns weeks for 14–29 days", () => {
    expect(timeAgo(14)).toBe("2 weeks ago");
    expect(timeAgo(21)).toBe("3 weeks ago");
  });

  it("returns '1 month ago' for 30–59 days", () => {
    expect(timeAgo(30)).toBe("1 month ago");
  });

  it("returns months for 60–364 days", () => {
    expect(timeAgo(90)).toBe("3 months ago");
  });

  it("returns '1 year ago' for 365–729 days", () => {
    expect(timeAgo(365)).toBe("1 year ago");
  });

  it("returns years for 730+ days", () => {
    expect(timeAgo(730)).toBe("2 years ago");
  });
});

describe("jobsDoneLabel", () => {
  it("returns new-user label for 0", () => {
    expect(jobsDoneLabel(0)).toBe("New on Mister Waan");
  });

  it("returns count for 1–99", () => {
    expect(jobsDoneLabel(42)).toBe("42 jobs done");
  });

  it("caps at 100+", () => {
    expect(jobsDoneLabel(100)).toBe("100+ jobs done");
    expect(jobsDoneLabel(250)).toBe("100+ jobs done");
  });
});
