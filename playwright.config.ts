import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://127.0.0.1:47832",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "HOME=/tmp/jig-playwright-home bun tests/browser/server.ts",
    url: "http://127.0.0.1:47832/api/v1/status",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
