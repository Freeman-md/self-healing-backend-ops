import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "@/config";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export class PrismaService extends PrismaClient {
  constructor(databaseUrl = config.database.url) {
    super({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }

  async executeInTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(operation);
  }

  async open(): Promise<void> {
    await this.$connect();
  }

  async close(): Promise<void> {
    await this.$disconnect();
  }
}
