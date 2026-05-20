import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("user-pwa — home", () => {
  test("loads the home page", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/Mister Waan/i);
  });

  test("shows the service selection grid", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/repairs/i)).toBeVisible();
    await expect(page.getByText(/detailing/i)).toBeVisible();
    await expect(page.getByText(/denting/i)).toBeVisible();
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
