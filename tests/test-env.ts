// Shared by vitest.config.ts, playwright.config.ts and the test helpers.
// Everything points at a dedicated `covercraft_test` database so the suites
// never touch the dev data in `covercraft`.

export const TEST_DB_NAME = "covercraft_test";
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_DB_NAME}`;
export const TEST_AUTH_SECRET = "covercraft-test-secret-do-not-use-in-production-7f3a";

// Demo-mode server (no OAuth / Stripe / Anthropic keys) and an "OAuth on"
// server with fake provider credentials. Both run the same production build.
export const DEMO_PORT = 3000;
export const OAUTH_PORT = 3002;
export const DEMO_URL = `http://localhost:${DEMO_PORT}`;
export const OAUTH_URL = `http://localhost:${OAUTH_PORT}`;

export const FAKE_GOOGLE = { id: "fake-google-client-id.apps.googleusercontent.com", secret: "fake-google-secret" };
export const FAKE_GITHUB = { id: "fake-github-client-id", secret: "fake-github-secret" };
export const FAKE_WEBHOOK_SECRET = "whsec_test_fake_covercraft_secret";
export const FAKE_PRICE_PRO = "price_test_pro";
export const FAKE_PRICE_BUSINESS = "price_test_business";

/** Env common to every process under test. Keys are blanked so a developer's
 * shell can't accidentally make the suites call real Anthropic / Stripe. */
export const BASE_ENV: Record<string, string> = {
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_URL: TEST_DATABASE_URL,
  AUTH_SECRET: TEST_AUTH_SECRET,
  ANTHROPIC_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1",
};

export const DEMO_SERVER_ENV: Record<string, string> = {
  ...BASE_ENV,
  APP_URL: DEMO_URL,
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  STRIPE_WEBHOOK_SECRET: "",
};

export const OAUTH_SERVER_ENV: Record<string, string> = {
  ...BASE_ENV,
  APP_URL: OAUTH_URL,
  GOOGLE_CLIENT_ID: FAKE_GOOGLE.id,
  GOOGLE_CLIENT_SECRET: FAKE_GOOGLE.secret,
  GITHUB_CLIENT_ID: FAKE_GITHUB.id,
  GITHUB_CLIENT_SECRET: FAKE_GITHUB.secret,
  // Lets the webhook tests sign real events locally (no Stripe account).
  STRIPE_WEBHOOK_SECRET: FAKE_WEBHOOK_SECRET,
  STRIPE_PRICE_PRO: FAKE_PRICE_PRO,
  STRIPE_PRICE_BUSINESS: FAKE_PRICE_BUSINESS,
};
