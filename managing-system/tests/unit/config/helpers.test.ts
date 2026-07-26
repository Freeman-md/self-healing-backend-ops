import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readBoolean,
  readNumber,
  readSqliteDatabaseUrl,
} from "@/config/helpers";

test("Docker execution configuration defaults safely and requires explicit values", () => {
  assert.equal(readBoolean(undefined, false), false);
  assert.equal(readBoolean("true", false), true);
  assert.equal(readBoolean("false", true), false);
  assert.throws(() => readBoolean("yes", false), /explicitly true or false/);
  assert.equal(readNumber(undefined, 10000), 10000);
  assert.throws(() => readNumber("0", 10000), /positive finite/);
  assert.throws(() => readNumber("not-a-number", 10000), /positive finite/);
});

test("SQLite configuration requires a non-empty Prisma file URL", () => {
  assert.equal(
    readSqliteDatabaseUrl("file:./data/test.sqlite"),
    "file:./data/test.sqlite",
  );
  assert.throws(() => readSqliteDatabaseUrl(undefined), /DATABASE_URL/);
  assert.throws(
    () => readSqliteDatabaseUrl("postgresql://localhost/test"),
    /SQLite file:/,
  );
  assert.throws(() => readSqliteDatabaseUrl("file:"), /database path/);
});
