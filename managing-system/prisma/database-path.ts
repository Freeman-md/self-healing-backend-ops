import { resolve } from "node:path";

export function resolveDatabasePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must use the Prisma SQLite file: protocol.");
  }

  const pathWithQuery = databaseUrl.slice("file:".length);
  const databasePath = decodeURIComponent(pathWithQuery.split("?")[0] ?? "");

  if (!databasePath || databasePath === ":memory:") {
    throw new Error("This operation requires a file-backed SQLite database.");
  }

  return resolve(databasePath);
}
