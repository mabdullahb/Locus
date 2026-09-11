import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Crafts an authenticated storage state once (tests/e2e/global-setup.ts)
  // instead of every test logging in separately.
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    storageState: "tests/e2e/.auth-state.json",
  },
});
