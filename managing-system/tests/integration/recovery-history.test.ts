import assert from "node:assert/strict";
import { test } from "node:test";
import { EvidenceRepository, type EvidenceSnapshot } from "@/modules/evidence";
import {
  RecoveryRepository,
  RecoveryService,
  RecoveryHistoryRepository,
  RecoveryHistoryService,
  type ControlledRecoveryEnvironment,
  recoveryEvidenceSignature,
} from "@/modules/recovery";
import { AttentionRepository, AttentionService } from "@/modules/attention";
import { OperatorRepository } from "@/modules/operator";
import { createPrismaTestDatabase } from "../helpers/prisma-test-database";

function snapshot(id: string, healthy = false): EvidenceSnapshot {
  return {
    id,
    rawEvidenceIds: [],
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    overallState: healthy ? "healthy" : "unhealthy",
    summary: "test",
    contradictions: [],
    suspectedIncidentTypes: healthy ? [] : ["managed_system_unreachable"],
    signals: [
      {
        code: "managed_system_reachability",
        name: "managed_system_reachability",
        value: healthy,
        status: healthy ? "normal" : "critical",
        source: "health",
        method: "deterministic",
        description: "test",
      },
      {
        code: "managed_system_container_state",
        name: "managed_system_container_state",
        value: healthy ? "running" : "exited",
        status: healthy ? "normal" : "critical",
        source: "container",
        method: "deterministic",
        description: "test",
      },
      {
        code: "postgres_container_state",
        name: "postgres_container_state",
        value: "running",
        status: "normal",
        source: "container",
        method: "deterministic",
        description: "test",
      },
    ],
  };
}

const diagnosis = {
  suspectedIncidentType: "managed_system_unreachable",
  severity: "high",
  confidence: 0.9,
  reasoningSummary: "Stopped app",
  supportingSignals: ["managed_system_container_state"],
  contradictions: [],
};

const plan = {
  status: "action_selected",
  reason: "Restart app",
  escalationReason: null,
  recoveryPlan: {
    proposedActionIds: ["restart_managed_system_service"],
    fallbackActionIds: [],
    rationale: "Stopped app",
    expectedOutcome: "healthy",
    escalationReason: null,
  },
};

test("diagnosis-first cold/warm reuse requires exact verified history and preserves adopted semantics", async () => {
  const db = await createPrismaTestDatabase({ seed: true });

  try {
    const evidence = new EvidenceRepository(db.prisma);

    const recovery = new RecoveryService(new RecoveryRepository(db.prisma));

    const repository = new RecoveryHistoryRepository(db.prisma, recovery, evidence);

    const history = new RecoveryHistoryService(repository, recovery);

    const initial = snapshot("initial");

    const healthy = snapshot("healthy", true);

    await evidence.saveEvidenceSnapshot(initial);
    await evidence.saveEvidenceSnapshot(healthy);
    const makeTrial = async (id: string, sourceIds: string[]) => {
      await db.prisma.trialRecord.create({
        data: {
          id,
          triggerSource: "monitor",
          recoveryMode: "agent",
          startedAt: new Date(),
          status: "started",
          outcome: "unresolved_not_escalated",
        },
      });
      await repository.createEpisode({
        trialRecordId: id,
        origin: "normal",
        experimentRunId: null,
        compatibilityFingerprint: "compatible",
        corpusSourceIds: sourceIds,
        retrievalEnabled: true,
      });
      let sequence = 0;

      const environment: ControlledRecoveryEnvironment = {
        trialRecordId: id,
        maxRecoverySteps: 3,
        actions: [
          {
            id: "restart_managed_system_service",
            name: "Restart",
            description: "Restart",
            riskLevel: "low",
            expectedOutcome: { description: "healthy", successCriteria: [] },
            maxAttempts: 1,
          },
        ],
        recordDecision: async (decision) =>
          recovery.recordRecoveryDecision({
            trialRecordId: id,
            sequenceNumber: ++sequence,
            recoveryDecision: decision,
          }),
        executeRegisteredAction: async () => {
          throw new Error("History must never execute actions");
        },
      };

      return history.createControlledOperations({
        environment,
        currentSnapshot: () => initial,
        fingerprint: "compatible",
        sourceIds,
      });
    };

    const cold = await makeTrial("cold", []);

    assert.equal((await cold.generatePlan(plan)).accepted, false);
    assert.equal((await cold.diagnoseAndLookup({ ...diagnosis, id: "forged" })).accepted, false);
    assert.equal(
      (await cold.diagnoseAndLookup({ ...diagnosis, supportingSignals: ["absent"] })).accepted,
      false,
    );
    const lookup = await cold.diagnoseAndLookup(diagnosis);

    assert.equal(lookup.accepted, true);
    assert.equal(await db.prisma.diagnosisResult.count(), 1);
    assert.equal(await db.prisma.recoveryPlan.count(), 0);
    const generated = await cold.generatePlan(plan);

    assert.ok(generated.decision);
    await repository.publishEligibleTrial("cold");
    assert.equal(await db.prisma.recoveryCase.count(), 0);
    const executionId = "safe-action";

    await db.prisma.actionExecutionResult.create({
      data: {
        id: executionId,
        trialRecordId: "cold",
        actionId: "restart_managed_system_service",
        beforeEvidenceSnapshotId: initial.id,
        afterEvidenceSnapshotId: healthy.id,
        status: "executed",
        continuation: "resolved",
        startedAt: new Date(),
        completedAt: new Date(),
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        expectedOutcomeMet: true,
      },
    });
    await repository.recordExecution(generated.decision, executionId);
    await db.prisma.trialRecord.update({
      where: { id: "cold" },
      data: {
        completedAt: new Date(),
        status: "resolved",
        outcome: "resolved_safely",
        evidenceHistory: {
          create: { evidenceSnapshotId: healthy.id, sequenceNumber: 1, role: "final" },
        },
      },
    });
    await repository.publishEligibleTrial("cold");
    assert.equal(await db.prisma.recoveryCase.count(), 1);
    const signature = recoveryEvidenceSignature(initial, diagnosis.suspectedIncidentType)!;

    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: [],
        signature,
        fingerprint: "compatible",
      }),
      null,
    );
    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: ["cold"],
        signature,
        fingerprint: "different",
      }),
      null,
    );
    await db.prisma.recoveryEpisode.update({
      where: { trialRecordId: "cold" },
      data: { origin: "unknown" },
    });
    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: ["cold"],
        signature,
        fingerprint: "compatible",
      }),
      null,
    );
    await db.prisma.recoveryEpisode.update({
      where: { trialRecordId: "cold" },
      data: { origin: "experiment", experimentRunId: "unverified-run" },
    });
    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: ["cold"],
        signature,
        fingerprint: "compatible",
      }),
      null,
    );
    await db.prisma.recoveryEpisode.update({
      where: { trialRecordId: "cold" },
      data: { origin: "normal", experimentRunId: null },
    });
    await db.prisma.recoveryStep.update({
      where: { planId: generated.decision.recoveryPlan.id },
      data: { executionResultIds: [] },
    });
    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: ["cold"],
        signature,
        fingerprint: "compatible",
      }),
      null,
    );
    await repository.recordExecution(generated.decision, executionId);
    const staleIds = Array.from({ length: 26 }, (_, index) => `stale-${index}`);

    for (const staleId of staleIds) {
      const stale = await makeTrial(staleId, []);

      await stale.diagnoseAndLookup(diagnosis);
      const stalePlan = await stale.generatePlan(plan);

      assert.ok(stalePlan.decision);
      await db.prisma.recoveryCase.create({
        data: {
          sourceTrialId: staleId,
          sourcePlanId: stalePlan.decision.recoveryPlan.id,
          diagnosisResultId: stalePlan.decision.diagnosisResult.id,
          publishedAt: new Date(Date.now() + 1000),
        },
      });
    }

    // Search beyond one page of stale cases without leaking an unallowlisted valid source.
    const eligible = await repository.findCandidate({
      currentTrialId: "warm",
      sourceIds: ["cold", ...staleIds],
      signature,
      fingerprint: "compatible",
    });

    assert.equal(eligible?.sourceTrialId, "cold");
    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: staleIds,
        signature,
        fingerprint: "compatible",
      }),
      null,
    );
    const warm = await makeTrial("warm", ["cold"]);

    const warmLookup = await warm.diagnoseAndLookup(diagnosis);

    const observation = warmLookup.observation as { candidate: { reference: string } };

    assert.ok(observation.candidate);
    assert.equal(
      (
        await warm.adoptPlan({
          candidateReference: "foreign",
          status: "action_selected",
          reason: "reuse",
        })
      ).accepted,
      false,
    );
    const adopted = await warm.adoptPlan({
      candidateReference: observation.candidate.reference,
      status: "action_selected",
      reason: "reuse",
    });

    assert.ok(adopted.decision);
    assert.notEqual(adopted.decision.recoveryPlan.id, generated.decision.recoveryPlan.id);
    assert.equal(
      adopted.decision.recoveryPlan.rationale,
      generated.decision.recoveryPlan.rationale,
    );
    assert.deepEqual(
      adopted.decision.recoveryPlan.proposedActionIds,
      generated.decision.recoveryPlan.proposedActionIds,
    );
    const persisted = await db.prisma.recoveryStep.findUniqueOrThrow({
      where: { planId: adopted.decision.recoveryPlan.id },
    });

    assert.equal(persisted.sourcePlanId, generated.decision.recoveryPlan.id);
    assert.equal(persisted.planOrigin, "retrieved");
    const operator = new OperatorRepository(db.prisma);

    const warmDetail = await operator.findTrialDetail("warm");

    for (const entry of warmDetail!.trail.filter(
      (entry) => entry.kind === "plan" || entry.kind === "decision",
    )) {
      assert.equal(entry.detail.planOrigin, "retrieved");
      assert.equal(entry.detail.sourceTrialId, "cold");
      assert.equal(entry.detail.sourcePlanId, generated.decision.recoveryPlan.id);
      assert.notEqual(entry.detail.sourcePlanId, adopted.decision.recoveryPlan.id);
    }

    const coldDetail = await operator.findTrialDetail("cold");

    const coldPlan = coldDetail!.trail.find((entry) => entry.kind === "plan")!;

    assert.equal(coldPlan.detail.planOrigin, "generated");
    assert.equal(coldPlan.detail.sourceTrialId, null);
    assert.equal(coldPlan.detail.sourcePlanId, null);
    assert.ok(
      persisted.diagnosisReadyAt <= persisted.lookupStartedAt! &&
        persisted.lookupCompletedAt! <= persisted.planReadyAt!,
    );
    warm.invalidate();
    assert.equal(
      (
        await warm.adoptPlan({
          candidateReference: observation.candidate.reference,
          status: "action_selected",
          reason: "reuse",
        })
      ).accepted,
      false,
    );
    await db.prisma.actionExecutionResult.update({
      where: { id: executionId },
      data: { safetyCheckStatus: "failed" },
    });
    assert.equal(
      await repository.findCandidate({
        currentTrialId: "warm",
        sourceIds: ["cold"],
        signature,
        fingerprint: "compatible",
      }),
      null,
    );
  } finally {
    await db.close();
  }
});

test("attention holds survive service reconstruction; review does not heal or release", async () => {
  const db = await createPrismaTestDatabase();

  try {
    await db.prisma.trialRecord.create({
      data: {
        id: "escalated",
        triggerSource: "monitor",
        recoveryMode: "agent",
        startedAt: new Date(),
        completedAt: new Date(),
        status: "escalated",
        outcome: "unresolved_escalated",
      },
    });
    const service = new AttentionService(new AttentionRepository(db.prisma));

    const initial = snapshot("attention-initial");

    const record = await service.recordEscalation({
      trialRecordId: "escalated",
      initialSnapshot: initial,
      latestSnapshot: initial,
      reason: "limit",
    });

    assert.equal(record.diagnosisResultId, null);
    await assert.rejects(service.reviewAttention(record.id, "review"));
    await service.acknowledgeAttention(record.id);
    await assert.rejects(service.reviewAttention(record.id, "  "));
    await service.reviewAttention(record.id, "Investigate manually");
    const restarted = new AttentionService(new AttentionRepository(db.prisma));

    assert.equal(await restarted.observeEvidence(initial), true);
    const changed = snapshot("changed");

    changed.signals[2].value = "exited";
    changed.signals[2].status = "critical";
    assert.equal(await restarted.observeEvidence(changed), false);
    assert.equal(await restarted.observeEvidence(snapshot("healthy", true)), false);
    assert.equal(await restarted.observeEvidence(initial), false);
    assert.equal((await restarted.readAttention(record.id)).healthyEvidenceSnapshotId, "healthy");
    assert.equal(
      (await db.prisma.trialRecord.findUniqueOrThrow({ where: { id: "escalated" } })).status,
      "escalated",
    );
  } finally {
    await db.close();
  }
});

test("controlled trials reject different monitor model, cadence, limits and executable identity", async () => {
  const db = await createPrismaTestDatabase();

  try {
    const recovery = new RecoveryService(new RecoveryRepository(db.prisma));

    const repository = new RecoveryHistoryRepository(
      db.prisma,
      recovery,
      new EvidenceRepository(db.prisma),
    );

    const actual = {
      sourceRevision: "a".repeat(40),
      model: "test-model",
      monitorIntervalMs: 1000,
      consecutiveUnhealthyThreshold: 2,
      cooldownMs: 5000,
      maxRecoverySteps: 3,
    };

    const manifest = {
      retrievalEnabled: true,
      sourceTrialIds: [],
      expectedRecoveryMode: "agent",
      expectedAgentStrategyVersion: "v2",
      compatibilityFingerprint: "compatible",
      protocol: { sourceRevision: actual.sourceRevision },
      configuration: {
        ...actual,
        agentImplementationVersion: "2.1.0",
        agentPromptVersion: "2.1.0",
      },
      maxAgentTurns: 12,
    };

    await db.prisma.experimentBatch.create({
      data: {
        id: "identity-batch",
        name: "identity",
        status: "active",
        sourceRevision: actual.sourceRevision,
        measurementVersion: "2.0.0",
        configuration: {},
        requestedRepetitions: 1,
        runOrderSeed: "test",
        createdAt: new Date(),
      },
    });
    await db.prisma.experimentRun.create({
      data: {
        id: "identity-run",
        batchId: "identity-batch",
        faultProfile: "managed_system_application_stopped",
        recoveryMode: "agent",
        repetition: 1,
        status: "prepared",
        activeLockKey: "global",
        startedAt: new Date(),
        stabilityWindowMs: 1000,
      },
    });
    await db.prisma.experimentRunManifest.create({
      data: { runId: "identity-run", configuration: manifest },
    });
    const mismatches: Partial<typeof actual>[] = [
      { model: "other-model" },
      { monitorIntervalMs: 2000 },
      { consecutiveUnhealthyThreshold: 3 },
      { cooldownMs: 9000 },
      { maxRecoverySteps: 2 },
      { sourceRevision: "b".repeat(40) },
      { sourceRevision: "unrecorded" },
    ];

    for (const [index, mismatch] of mismatches.entries()) {
      const id = `identity-${index}`;

      await db.prisma.trialRecord.create({
        data: {
          id,
          recoveryMode: "agent",
          status: "started",
          outcome: "unresolved_not_escalated",
          startedAt: new Date(),
        },
      });
      const service = new RecoveryHistoryService(repository, recovery, undefined, {
        enabled: true,
        sourceIds: [],
        recoveryMode: "agent",
        agentStrategyVersion: "v2",
        fingerprint: async () => "compatible",
        runtimeIdentity: { ...actual, ...mismatch },
      });

      await assert.rejects(service.beginTrial(id, "monitor"));
    }

    assert.equal(await db.prisma.recoveryEpisode.count(), 0);
    const matching = new RecoveryHistoryService(repository, recovery, undefined, {
      enabled: true,
      sourceIds: [],
      recoveryMode: "agent",
      agentStrategyVersion: "v2",
      fingerprint: async () => "compatible",
      runtimeIdentity: actual,
    });

    await matching.beginTrial("identity-0", "monitor");
    assert.deepEqual(
      (
        await db.prisma.recoveryEpisode.findUniqueOrThrow({
          where: { trialRecordId: "identity-0" },
        })
      ).configuration,
      { measurementVersion: "2.0.0", protocol: "structured-exact-v1", runtimeIdentity: actual },
    );
    assert.equal(await db.prisma.recoveryEpisode.count(), 1);
    await db.prisma.experimentRunManifest.update({
      where: { runId: "identity-run" },
      data: { configuration: { ...manifest, maxAgentTurns: 8 } },
    });
    await assert.rejects(matching.beginTrial("identity-1", "monitor"));
    await db.prisma.experimentRunManifest.update({
      where: { runId: "identity-run" },
      data: {
        configuration: {
          ...manifest,
          configuration: { ...manifest.configuration, agentPromptVersion: "different" },
        },
      },
    });
    await assert.rejects(matching.beginTrial("identity-2", "monitor"));
  } finally {
    await db.close();
  }
});
