import { databaseClient, type ManagedSystemDatabase } from "./client";

export type ManagedSystemTransaction = Parameters<
  Parameters<ManagedSystemDatabase["transaction"]>[0]
>[0];

type QueryFactory<TResult> = (
  database: ManagedSystemDatabase,
) => Promise<TResult[]>;

type TransactionCallback<TResult> = (
  database: ManagedSystemTransaction,
) => Promise<TResult>;

export class DatabaseService {
  readonly client: ManagedSystemDatabase;

  constructor(client: ManagedSystemDatabase) {
    this.client = client;
  }

  async findMany<TResult>(
    queryFactory: QueryFactory<TResult>,
    database: ManagedSystemDatabase = this.client,
  ): Promise<TResult[]> {
    return queryFactory(database);
  }

  async findFirst<TResult>(
    queryFactory: QueryFactory<TResult>,
    database: ManagedSystemDatabase = this.client,
  ): Promise<TResult | null> {
    const rows = await this.findMany(queryFactory, database);

    return rows[0] ?? null;
  }

  async withTransaction<TResult>(
    callback: TransactionCallback<TResult>,
  ): Promise<TResult> {
    return this.client.transaction(async (transaction) => callback(transaction));
  }
}

export const databaseService = new DatabaseService(databaseClient);
