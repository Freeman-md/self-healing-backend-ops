import test from "node:test";
import assert from "node:assert/strict";
import { OperatorService, OperatorRepository } from "@/modules/operator";

test("an accepted request reconciles before readiness and never launches a second run", async () => {
  const input = {
    requestId: "f4498557-1e65-42cd-bcc8-693f0a9819c2",
    profile: "managed_system_application_stopped" as const,
    strategy: "v2" as const,
    workload: "idle" as const,
  };

  const accepted = {
    requestId: input.requestId,
    runId: `operator-run-${input.requestId}`,
    accepted: true,
  };

  const service = new OperatorService(
    { findAcceptedOperatorRequest: async () => accepted } as unknown as OperatorRepository,
    {} as never,
    {} as never,
    {
      launch: async () => {
        throw new Error("Must not relaunch");
      },
    },
    {
      monitoringIntervalMs: 30_000,
      dockerActionsEnabled: true,
      agentAvailable: true,
      reuseAvailable: false,
      sourceRevision: "a".repeat(40),
    },
  );

  assert.deepEqual(await service.launchControlledTest(input), accepted);
});
