import "dotenv/config";

import { resolve } from "node:path";

import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.startsWith("file:") || databaseUrl.length <= "file:".length) {
  throw new Error("DATABASE_URL must be a non-empty Prisma SQLite file: URL.");
}

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: resolvePrismaDatabaseUrl(databaseUrl),
  },
});

function resolvePrismaDatabaseUrl(url: string): string {
  const pathWithQuery = url.slice("file:".length);
  const [databasePath, query] = pathWithQuery.split("?", 2);

  if (!databasePath) {
    throw new Error("DATABASE_URL must contain a SQLite database path.");
  }

  const absolutePath = resolve(databasePath);
  return `file:${absolutePath}${query ? `?${query}` : ""}`;
}
