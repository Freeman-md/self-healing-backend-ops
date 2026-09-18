import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readBuildRevision } from "@/config/build-identity";

test("build revision is a validated non-secret build artifact, with absent identity explicit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "m9-build-identity-"));

  const path = join(directory, "build-identity.json");

  try {
    assert.equal(readBuildRevision(path), "unrecorded");
    await writeFile(path, JSON.stringify({ sourceRevision: "a".repeat(40) }));
    assert.equal(readBuildRevision(path), "a".repeat(40));
    await writeFile(path, JSON.stringify({ sourceRevision: "not-a-revision" }));
    assert.throws(() => readBuildRevision(path), /build identity is invalid/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
