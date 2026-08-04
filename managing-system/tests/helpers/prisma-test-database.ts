import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Database from "better-sqlite3";

import { PrismaService } from "@/infrastructure/database";
import { seedCatalogue } from "../../prisma/catalogue";

export async function createPrismaTestDatabase(options?: {
  seed?: boolean;
}): Promise<{
  prisma: PrismaService;
  databaseUrl: string;
  close(): Promise<void>;
}> {
  const directory = mkdtempSync(join(tmpdir(), "managing-system-prisma-"));
  const databasePath = join(directory, "test.sqlite");
  const migrationPath = resolve(
    "prisma/migrations/20260726120000_relational_persistence/migration.sql",
  );
  const database = new Database(databasePath);

  try {
    database.exec(readFileSync(migrationPath, "utf8"));
  } finally {
    database.close();
  }

  const databaseUrl = `file:${databasePath}`;
  const prisma = new PrismaService(databaseUrl);
  await prisma.open();

  if (options?.seed) {
    await seedCatalogue(prisma);
  }

  return {
    prisma,
    databaseUrl,
    async close() {
      await prisma.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
