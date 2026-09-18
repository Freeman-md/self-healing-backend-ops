import test from "node:test";
import assert from "node:assert/strict";

import {
  controlledTestRequestSchema,
  operatorListTrialsQuerySchema,
} from "@/modules/operator/operator.schema";
import { hasLocalMutationGuard } from "@/modules/operator/operator-http.guard";

test("controlled-test requests only accept registered profiles and one idle workload", () => {
  assert.equal(
    controlledTestRequestSchema.safeParse({
      requestId: "f4498557-1e65-42cd-bcc8-693f0a9819c2",
      profile: "managed_system_application_stopped",
      strategy: "v2",
      workload: "idle",
    }).success,
    true,
  );
  assert.equal(
    controlledTestRequestSchema.safeParse({
      requestId: "f4498557-1e65-42cd-bcc8-693f0a9819c2",
      profile: "arbitrary_command",
      strategy: "v2",
      workload: "idle",
    }).success,
    false,
  );
});

test("trial query bounds pagination and search", () => {
  assert.deepEqual(operatorListTrialsQuerySchema.parse({ limit: "50", search: "run-123" }), {
    limit: 50,
    search: "run-123",
  });
  assert.equal(operatorListTrialsQuerySchema.safeParse({ limit: "51" }).success, false);
});

test("mutation caller guard requires the local origin, host and request marker", () => {
  assert.equal(
    hasLocalMutationGuard(
      { host: "127.0.0.1:4300", origin: "http://127.0.0.1:4300", "x-operator-request": "1" },
      4300,
    ),
    true,
  );
  assert.equal(
    hasLocalMutationGuard({ host: "127.0.0.1:4300", origin: "https://example.test" }, 4300),
    false,
  );
});
