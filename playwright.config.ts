import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Test helpers use the Supabase keys to create and delete throwaway users.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const port = 3000;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  // The dev server compiles each route on first visit, which can take a few seconds.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Most talent use phones, so every flow is tested on mobile as well as desktop.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
