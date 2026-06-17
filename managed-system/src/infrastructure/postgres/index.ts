import { Pool, type PoolConfig } from "pg";

import { config } from "@/config/index";
import type { DatabaseConfig } from "@/types/config";

function buildPoolConfig(databaseConfig: DatabaseConfig): PoolConfig {
  if (databaseConfig.connectionUrl) {
    return {
      connectionString: databaseConfig.connectionUrl,
    };
  }

  return {
    host: databaseConfig.host,
    port: databaseConfig.port,
    database: databaseConfig.name,
    user: databaseConfig.user,
    password: databaseConfig.password,
  };
}

export function createPostgresPool(
  databaseConfig: DatabaseConfig = config.database,
): Pool {
  return new Pool(buildPoolConfig(databaseConfig));
}

export async function checkPostgresConnection(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query("select 1");
}

export const postgresPool = createPostgresPool();
