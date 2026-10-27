import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { BASE_ENV, TEST_DATABASE_URL, TEST_DB_NAME } from "./test-env";

/** Creates covercraft_test if needed and applies every migration to it. */
export function migrateTestDb() {
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, ...BASE_ENV },
    stdio: "pipe",
  });
}

export function testDb() {
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
}

/** Empties every app table. Refuses to run against anything but the test DB. */
export async function truncateAll(db: PrismaClient) {
  const [{ current_database }] = await db.$queryRaw<{ current_database: string }[]>`
    SELECT current_database()`;
  if (current_database !== TEST_DB_NAME) {
    throw new Error(`Refusing to truncate ${current_database}: not the test database`);
  }
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "Account", "Generation", "User", "RateLimit" RESTART IDENTITY CASCADE'
  );
}
