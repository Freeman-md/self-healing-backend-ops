import { databaseClient, type ManagedSystemDatabase } from "./client";

export class DatabaseAccessLayer {
  readonly client: ManagedSystemDatabase;

  constructor(client: ManagedSystemDatabase) {
    this.client = client;
  }

  async queryMany<T>(
    queryFactory: (database: ManagedSystemDatabase) => Promise<T[]>,
    database: ManagedSystemDatabase = this.client,
  ): Promise<T[]> {
    return queryFactory(database);
  }

  async queryFirst<T>(
    queryFactory: (database: ManagedSystemDatabase) => Promise<T[]>,
    database: ManagedSystemDatabase = this.client,
  ): Promise<T | null> {
    const rows = await queryFactory(database);

    return rows[0] ?? null;
  }
}

export const databaseAccess = new DatabaseAccessLayer(databaseClient);
