import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3002";

test.describe("ops — mechanic list", () => {
  test("loads the mechanics list", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/ops/i);
  });

  test("shows mechanic rows", async ({ page }) => {
    await page.goto(BASE);
    // Nav bar shows total count
    await expect(page.getByText(/mechanics/i).first()).toBeVisible();
  });

  test("filter bar is present", async ({ page }) => {
    await page.goto(BASE);
    const filterInput = page.getByRole("textbox");
    await expect(filterInput).toBeVisible();
  });

  test("map view loads", async ({ page }) => {
    await page.goto(`${BASE}/map`);
    // Map container should be rendered
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10_000 });
  });
});
