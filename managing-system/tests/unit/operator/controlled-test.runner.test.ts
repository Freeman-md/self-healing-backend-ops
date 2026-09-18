import test from "node:test";
import assert from "node:assert/strict";
import {
  LocalControlledTestRunner,
  OperatorRepository,
  type OperatorStrategyId,
} from "@/modules/operator";
import type { ExperimentService } from "@/modules/experiment";

for (const [strategy, version, turns] of [
  ["baseline", "1.0.0", null],
  ["v1", "1.0.0", null],
  ["v2", "2.0.0", 8],
  ["v2-reuse", "2.1.0", 12],
] as const) {
  test(`${strategy} freezes the identity required by the monitor`, async () => {
    const input = {
      requestId: "f4498557-1e65-42cd-bcc8-693f0a9819c2",
      profile: "managed_system_application_stopped" as const,
      strategy: strategy as OperatorStrategyId,
      workload: "idle" as const,
    };

    let reads = 0;

    let manifest: Record<string, unknown> = {};

    const accepted = {
      requestId: input.requestId,
      runId: `operator-run-${input.requestId}`,
      accepted: true,
    };

    const repository = {
      findAcceptedOperatorRequest: async () => (++reads === 1 ? null : accepted),
      createOrReadOperatorRun: async (data: { configuration: Record<string, unknown> }) => {
        manifest = data.configuration;

        return { created: false, run: { id: accepted.runId } };
      },
    } as unknown as OperatorRepository;

    const runner = new LocalControlledTestRunner(
      repository,
      { createFrozenConfiguration: async (data: unknown) => data } as ExperimentService,
      {} as never,
      {
        sourceRevision: "a".repeat(40),
        model: "test-model",
        targetOrigin: "http://managed-system:3000",
        monitoring: { intervalMs: 30_000, consecutiveUnhealthyThreshold: 2, cooldownMs: 60_000 },
        sourceTrialIds: [],
        compatibilityFingerprint: async () => "fingerprint",
        ensureReady: async () => undefined,
      },
    );

    assert.deepEqual(await runner.launch(input), accepted);
    assert.equal(
      (manifest.configuration as Record<string, unknown>).agentImplementationVersion,
      version,
    );
    assert.equal((manifest.configuration as Record<string, unknown>).agentPromptVersion, version);
    assert.equal(manifest.maxAgentTurns, turns);
    assert.equal(manifest.requestedStrategy, strategy);
  });
}
