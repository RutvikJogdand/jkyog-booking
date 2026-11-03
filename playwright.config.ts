import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3010",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
  ],
});
