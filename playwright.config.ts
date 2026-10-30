import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
    timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    // Run against a production build: deterministic and immune to dev-mode
    // compile stalls and Fast-Refresh reloads.
    command: "rm -rf .test-data .next-test && npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      MARKETPLACE_DATA_DIR: ".test-data",
      NEXT_DIST_DIR: ".next-test",
    },
  },
});
