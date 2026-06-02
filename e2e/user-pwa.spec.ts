import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("user-pwa — home", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/AutoGTG/i);
  });

  test("shows the service menu", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/roadside assistance/i)).toBeVisible();
    await expect(page.getByText(/explore all services/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /AC compressor repair/i }),
    ).toBeVisible();
  });

  test("tab bar is visible", async ({ page }) => {
    await page.goto(BASE);
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(BASE);
    expect(errors).toHaveLength(0);
  });
});

test.describe("user-pwa — navigation", () => {
  test("navigates to bookings tab", async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole("link", { name: /bookings/i }).click();
    await expect(page).toHaveURL(/\/bookings/);
  });
});
