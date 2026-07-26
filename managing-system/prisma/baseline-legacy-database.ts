import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";

import { config } from "../src/config";
import { resolveDatabasePath } from "./database-path";

const migrationName = "20260726120000_relational_persistence";
const migrationPath = resolve(
  "prisma",
  "migrations",
  migrationName,
  "migration.sql",
);
const databasePath = resolveDatabasePath(config.database.url);

if (!existsSync(databasePath)) {
  throw new Error(`Configured SQLite database does not exist: ${databasePath}`);
}

const database = new Database(databasePath);
let schemaCreated = false;

try {
  const migrationHistoryExists = tableExists(database, "_prisma_migrations");
  const legacyTablesExist = tableExists(database, "legacy_trial_records");
  const normalizedTables = ["actions", "evidence_snapshots", "trial_records"];
  const normalizedTableCount = normalizedTables.filter((tableName) =>
    tableExists(database, tableName),
  ).length;

  if (migrationHistoryExists) {
    throw new Error(
      "Legacy baseline must run before Prisma migration history exists.",
    );
  }

  if (!legacyTablesExist) {
    throw new Error(
      "Legacy baseline requires the prepared legacy_* tables. Run prisma:prepare-legacy first.",
    );
  }

  if (
    normalizedTableCount > 0 &&
    normalizedTableCount !== normalizedTables.length
  ) {
    throw new Error(
      "Normalized schema is only partially present; restore the verified backup before retrying.",
    );
  }

  if (normalizedTableCount === 0) {
    const migrationSql = readFileSync(migrationPath, "utf8");
    database.transaction(() => database.exec(migrationSql))();
    schemaCreated = true;
  }
} finally {
  database.close();
}

const resolution = spawnSync(
  process.execPath,
  [
    resolve("node_modules", "prisma", "build", "index.js"),
    "migrate",
    "resolve",
    "--applied",
    migrationName,
  ],
  {
    cwd: resolve("."),
    env: process.env,
    encoding: "utf8",
  },
);

if (resolution.status !== 0) {
  throw new Error(
    `Prisma migration-history baseline failed: ${resolution.stderr || resolution.stdout}`,
  );
}

console.log({
  event: "legacy_migration_baselined",
  databasePath,
  migrationName,
  schemaCreated,
});

function tableExists(
  databaseConnection: Database.Database,
  tableName: string,
): boolean {
  return Boolean(
    databaseConnection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tableName),
  );
}
