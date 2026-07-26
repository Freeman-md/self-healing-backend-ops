import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "../src/config";
import { resolveDatabasePath } from "./database-path";

const databasePath = resolveDatabasePath(config.database.url);
const existed = existsSync(databasePath);

mkdirSync(dirname(databasePath), { recursive: true });
closeSync(openSync(databasePath, "a"));

console.log({
  event: "sqlite_database_prepared",
  databasePath,
  created: !existed,
});
