// Local Postgres for development — no Docker, no account, no install.
// Runs a real Postgres 17 (same major version as Neon) from the
// `embedded-postgres` npm binaries, persisting data in ./.pgdata.
//
//   npm run db        # leave it running in its own terminal
//
// Matching .env:
//   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/covercraft"
//   DIRECT_URL="postgresql://postgres:postgres@localhost:5433/covercraft"
import { existsSync } from "node:fs";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = join(process.cwd(), ".pgdata");
const PORT = Number(process.env.PGPORT ?? 5433);
const DB_NAME = "covercraft";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: "postgres",
  password: "postgres",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

const firstRun = !existsSync(join(DATA_DIR, "PG_VERSION"));
if (firstRun) {
  console.log("Initialising a new Postgres cluster in .pgdata …");
  await pg.initialise();
}

await pg.start();

const client = pg.getPgClient();
await client.connect();
const { rowCount } = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  [DB_NAME]
);
await client.end();
if (rowCount === 0) await pg.createDatabase(DB_NAME);

console.log(
  `Postgres ready → postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}`
);
console.log("Press Ctrl+C to stop.");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
