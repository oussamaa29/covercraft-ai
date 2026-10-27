import { migrateTestDb, testDb, truncateAll } from "../test-db";

export default async function setup() {
  migrateTestDb();
  const db = testDb();
  try {
    await truncateAll(db);
  } finally {
    await db.$disconnect();
  }
}
