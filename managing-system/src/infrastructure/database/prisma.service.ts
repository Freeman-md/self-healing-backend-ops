import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { config } from "@/config";
import { PrismaClient } from "@/generated/prisma/client";

export class PrismaService extends PrismaClient {
  constructor(databaseUrl = config.database.url) {
    ensureSqliteDirectory(databaseUrl);

    super({
      adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
    });
  }

  async open(): Promise<void> {
    await this.$connect();
  }

  async close(): Promise<void> {
    await this.$disconnect();
  }
}

function ensureSqliteDirectory(databaseUrl: string): void {
  const databasePath = databaseUrl.slice("file:".length);

  if (databasePath === ":memory:" || databasePath.startsWith(":memory:?")) {
    return;
  }

  const resolvedPath = resolve(databasePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
}
