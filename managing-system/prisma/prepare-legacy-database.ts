import { existsSync } from "node:fs";

import Database from "better-sqlite3";

import { config } from "../src/config";
import { resolveDatabasePath } from "./database-path";

const databasePath = resolveDatabasePath(config.database.url);

if (!existsSync(databasePath)) {
  throw new Error(`Configured SQLite database does not exist: ${databasePath}`);
}

const database = new Database(databasePath);
const legacyTables = [
  "evidence_snapshots",
  "trial_records",
  "diagnosis_results",
  "recovery_plans",
  "recovery_decisions",
  "action_execution_results",
  "evaluation_summaries",
] as const;
const renamedTables: string[] = [];
let alreadyManagedByPrisma = false;

try {
  alreadyManagedByPrisma = tableExists(database, "_prisma_migrations");

  if (!alreadyManagedByPrisma) {
    database.transaction(() => {
      for (const tableName of legacyTables) {
        const legacyName = `legacy_${tableName}`;

        if (tableExists(database, legacyName)) {
          continue;
        }

        if (tableExists(database, tableName)) {
          database.exec(`ALTER TABLE "${tableName}" RENAME TO "${legacyName}"`);
          renamedTables.push(tableName);
        }
      }
    })();
  }
} finally {
  database.close();
}

console.log({
  event: "legacy_database_prepared",
  databasePath,
  renamedTables,
  alreadyManagedByPrisma,
});

function tableExists(databaseConnection: Database.Database, name: string): boolean {
  return Boolean(
    databaseConnection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name),
  );
}
