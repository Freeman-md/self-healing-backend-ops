import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readBoolean,
  readNumber,
  readPostgresDatabaseUrl,
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

test("PostgreSQL configuration requires a non-empty connection URL", () => {
  assert.equal(
    readPostgresDatabaseUrl("postgresql://postgres:postgres@localhost:5433/test_database"),
    "postgresql://postgres:postgres@localhost:5433/test_database",
  );
  assert.throws(() => readPostgresDatabaseUrl(undefined), /DATABASE_URL/);
  assert.throws(
    () => readPostgresDatabaseUrl("file:./data/test.sqlite"),
    /PostgreSQL connection URL/,
  );
  assert.throws(
    () => readPostgresDatabaseUrl("postgresql://localhost"),
    /host and database name/,
  );
});
