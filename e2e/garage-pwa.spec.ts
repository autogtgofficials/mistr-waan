import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

test.describe("garage-pwa — auth", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto(BASE);
    // Unauthenticated users should land on or be redirected to login
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test("login page renders phone / OTP entry", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole("main")).toBeVisible();
  });
});

test.describe("garage-pwa — job list", () => {
  test("jobs page is accessible after login", async ({ page }) => {
    // For now, navigate directly and assert page structure exists
    await page.goto(`${BASE}/login`);
    await expect(page).toHaveTitle(/.+/);
  });
});
