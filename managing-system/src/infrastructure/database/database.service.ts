import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { config } from "@/config";

export class DatabaseService {
  private readonly database: DatabaseSync;

  constructor(path = config.database.path) {
    mkdirSync(dirname(path), {
      recursive: true,
    });

    this.database = new DatabaseSync(path);
  }

  getConnection(): DatabaseSync {
    return this.database;
  }

  close(): void {
    this.database.close();
  }
}
