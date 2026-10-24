import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    // A browser driven by Playwright is, rightly, treated as automation by the exam-integrity layer and would be locked out of any
    // proctored page. This build-time switch (never set in a production build) lets OUR OWN test runs through. The API those runs
    // talk to should have INTEGRITY_ENABLED=false (docs/exam-integrity.md → Troubleshooting).
    env: { NEXT_PUBLIC_INTEGRITY_ALLOW_AUTOMATION: "1" },
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
