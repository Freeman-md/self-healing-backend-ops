import "dotenv/config";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { databaseClient } from "./client";

async function runMigrations() {
  await migrate(databaseClient, {
    migrationsFolder: "./drizzle",
  });

  console.info("Database migrations applied");
}

void runMigrations()
  .catch((error) => {
    console.error("Database migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    process.exit();
  });
