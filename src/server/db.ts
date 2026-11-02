import "server-only";
import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import neonConfig from "../../neon";

let pool: Pool | undefined;

// Created on first use so `next build` never needs DATABASE_URL or a live database.
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
  const newPool = new Pool({ connectionString: postgres.databaseUrl });

  // Neon closes idle connections (for example when compute scales to zero); without a
  // listener, pg rethrows that error and crashes the process.
  newPool.on("error", (error) => {
    console.error("Idle PostgreSQL client error:", error.message);
  });

  attachDatabasePool(newPool);
  pool = newPool;
  return pool;
}
