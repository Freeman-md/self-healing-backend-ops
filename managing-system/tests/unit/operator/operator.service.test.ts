import test from "node:test";
import assert from "node:assert/strict";
import { OperatorService, OperatorRepository } from "@/modules/operator";
import type { OperatorRuntime } from "@/modules/operator";

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

for (const revision of ["a".repeat(40), "unrecorded"]) {
  test(`critical evidence outranks unknown signals and cannot authorize launch (${revision})`, async () => {
    const repository = {
      findLatestEvidence: async () => ({
        id: "snapshot",
        createdAt: new Date(),
        summary: "Container stopped",
        contradictions: [],
        signals: [
          {
            method: "deterministic",
            status: "critical",
            code: "managed_system_reachability",
            name: "Reachability",
            value: false,
            description: "Unreachable",
          },
          {
            method: "deterministic",
            status: "unknown",
            code: "database_connectivity",
            name: "Database",
            value: null,
            description: "Unavailable health endpoint",
          },
        ],
      }),
      readActiveRun: async () => null,
    } as unknown as OperatorRepository;

    const runtime = {
      status: () => ({ state: "observing", heartbeatAt: null, strategy: null }),
    } as OperatorRuntime;

    const service = new OperatorService(repository, {} as never, runtime, {} as never, {
      monitoringIntervalMs: 30_000,
      dockerActionsEnabled: true,
      agentAvailable: true,
      reuseAvailable: false,
      sourceRevision: revision,
    });

    const state = await service.readState();

    assert.equal(state.evidence?.overallState, "unhealthy");
    assert.equal(state.monitor.readiness.canLaunch, false);
    assert.equal(
      state.monitor.readiness.reasons.some((reason) => reason.includes("SOURCE_REVISION")),
      revision === "unrecorded",
    );
  });
}
