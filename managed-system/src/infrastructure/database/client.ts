import { drizzle } from "drizzle-orm/node-postgres";

import { postgresPool } from "@/infrastructure/postgres/index";

import * as schema from "./schema";

export const databaseClient = drizzle(postgresPool, {
  schema,
});

export type ManagedSystemDatabase = typeof databaseClient;
