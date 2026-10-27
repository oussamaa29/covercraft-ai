import { migrateTestDb, testDb, truncateAll } from "../test-db";

// Runs after the web servers are up (Playwright starts webServer first), which
// is fine: Prisma only connects on the first query.
export default async function globalSetup() {
  migrateTestDb();
  const db = testDb();
  try {
    await truncateAll(db);
  } finally {
    await db.$disconnect();
  }
}
