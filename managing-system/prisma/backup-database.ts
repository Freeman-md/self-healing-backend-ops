import { copyFileSync, constants, existsSync, statSync } from "node:fs";

import { config } from "../src/config";
import { resolveDatabasePath } from "./database-path";

const sourcePath = resolveDatabasePath(config.database.url);

if (!existsSync(sourcePath)) {
  throw new Error(`Configured SQLite database does not exist: ${sourcePath}`);
}

const timestamp = new Date().toISOString().replaceAll(":", "-");
const backupPath = `${sourcePath}.${timestamp}.backup`;

copyFileSync(sourcePath, backupPath, constants.COPYFILE_EXCL);

const sourceSize = statSync(sourcePath).size;
const backupSize = statSync(backupPath).size;

if (sourceSize !== backupSize) {
  throw new Error(
    `Backup size mismatch: source=${sourceSize}, backup=${backupSize}.`,
  );
}

console.log({
  event: "sqlite_backup_created",
  sourcePath,
  backupPath,
  fileSizeBytes: backupSize,
});
