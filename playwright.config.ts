import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build:
 *   npm run build && npm start   (in one terminal)
 *   npm run test:e2e             (in another)
 * Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run the admin tests.
 */
// Sandbox/CI machines may provide a Chromium binary instead of the Playwright download.
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    // Chromium-based phone emulation so the suite needs only one browser download.
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions }, testMatch: /flow|a11y/ },
  ],
});
