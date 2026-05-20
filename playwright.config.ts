import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      name: "user-pwa",
      command: "pnpm --filter user-pwa dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
    {
      name: "ops",
      command: "pnpm --filter ops dev",
      url: "http://localhost:3002",
      reuseExistingServer: !process.env.CI,
    },
    {
      name: "garage-pwa",
      command: "pnpm --filter garage-pwa dev",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
