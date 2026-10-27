import path from "node:path";
import { defineConfig } from "vitest/config";
import { BASE_ENV } from "./tests/test-env";

const root = process.cwd();

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.join(root, "src")}/` },
      // The real package throws outside a React Server Components bundle.
      { find: /^server-only$/, replacement: path.join(root, "node_modules/server-only/empty.js") },
    ],
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { ...BASE_ENV, APP_URL: "http://localhost:3000" },
    globalSetup: ["tests/unit/global-setup.ts"],
    // One shared Postgres database: files run one at a time so a TRUNCATE in
    // one suite can't pull rows out from under another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
