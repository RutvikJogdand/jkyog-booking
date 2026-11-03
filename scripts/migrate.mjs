// Applies db/migrations/*.sql in name order (each once), then db/seed.sql.
// Usage: node --env-file=.env.local scripts/migrate.mjs [ENV_VAR_WITH_DIRECT_URL]
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const urlVar = process.argv[2] ?? "DATABASE_URL_UNPOOLED";
const connectionString = process.env[urlVar];
if (!connectionString) {
  console.error(`${urlVar} is not set.`);
  process.exit(1);
}

const migrationsDir = new URL("../db/migrations/", import.meta.url);
const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const { rowCount } = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [name],
    );
    if (rowCount > 0) continue;

    const sql = await readFile(new URL(name, migrationsDir), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        name,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const seed = await readFile(
    new URL("../db/seed.sql", import.meta.url),
    "utf8",
  );
  const { rowCount } = await client.query(seed);
  console.log(`Seed inserted ${rowCount} missing inventory rows.`);
} finally {
  await client.end();
}
