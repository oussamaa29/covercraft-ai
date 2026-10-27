import { defineConfig, devices } from "@playwright/test";
import {
  DEMO_PORT,
  DEMO_SERVER_ENV,
  DEMO_URL,
  OAUTH_PORT,
  OAUTH_SERVER_ENV,
  OAUTH_URL,
} from "./tests/test-env";

// E2E_SKIP_BUILD=1 reuses the existing .next build; E2E_REUSE_SERVERS=1 lets
// you keep servers running between runs while writing tests.
const skipBuild = Boolean(process.env.E2E_SKIP_BUILD);
const reuse = Boolean(process.env.E2E_REUSE_SERVERS);

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: {
    baseURL: DEMO_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "api", testMatch: /api[\\/].*\.spec\.ts$/ },
    {
      name: "chromium",
      testMatch: /ui[\\/].*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Two servers from one production build: demo mode (no keys at all) and an
  // "OAuth configured" one with fake Google/GitHub credentials + a fake
  // Stripe webhook secret. Both use the covercraft_test database.
  webServer: [
    {
      command: skipBuild
        ? `npx next start -p ${DEMO_PORT}`
        : `npx next build && npx next start -p ${DEMO_PORT}`,
      url: `${DEMO_URL}/robots.txt`,
      env: DEMO_SERVER_ENV,
      reuseExistingServer: reuse,
      timeout: 600_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `npx next start -p ${OAUTH_PORT}`,
      url: `${OAUTH_URL}/robots.txt`,
      env: OAUTH_SERVER_ENV,
      reuseExistingServer: reuse,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
