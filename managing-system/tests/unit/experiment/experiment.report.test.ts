import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createExperimentSummary,
  type ExperimentRunRecord,
} from "@/modules/experiment";

function run(
  overrides: Partial<ExperimentRunRecord> = {},
): ExperimentRunRecord {
  return {
    id: "run-1",
    batchId: "batch-1",
    faultProfile: "managed_system_application_stopped",
    recoveryMode: "baseline",
    repetition: 1,
    status: "completed",
    startedAt: "2026-08-17T10:00:00.000Z",
    faultInjectedAt: "2026-08-17T10:00:01.000Z",
    completedAt: "2026-08-17T10:00:10.000Z",
    trialRecordId: "trial-1",
    valid: true,
    exclusionReason: null,
    runtimeResolved: true,
    oracleSucceeded: true,
    oracleCheckedAt: "2026-08-17T10:00:09.000Z",
    oracleDetails: {},
    stabilityWindowMs: 1_000,
    diagnosisCorrect: true,
    actionSequenceCorrect: true,
    unnecessaryActionCount: 0,
    faultToDetectionMs: 1_000,
    timeToHealMs: 8_000,
    timeToTerminationMs: 9_000,
    trial: {
      status: "resolved",
      outcome: "resolved_safely",
      actionCount: 1,
      blockedActionCount: 0,
      failedActionCount: 0,
      safetyMaintained: true,
      timeToRecoveryMs: 7_000,
      timeToEscalationMs: null,
      measurement: {
        unhealthyConfirmationDelayMs: 2_000,
        timeToFirstActionMs: 1_000,
        recoveryLoopDurationMs: 5_000,
        observedTimeToHealMs: 7_000,
        decisionCount: 1,
      },
      modelInvocations: [
        {
          operation: "outcome_evaluation",
          durationMs: 500,
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          status: "succeeded",
        },
      ],
    },
    ...overrides,
  };
}

test("experiment summaries retain failed outcomes without fabricating healing time", () => {
  const summary = createExperimentSummary([
    run(),
    run({
      id: "run-2",
      runtimeResolved: true,
      oracleSucceeded: false,
      timeToHealMs: null,
      diagnosisCorrect: false,
    }),
    run({
      id: "run-3",
      valid: false,
      status: "invalid",
      runtimeResolved: null,
      oracleSucceeded: null,
      timeToHealMs: null,
      exclusionReason: "Ambiguous monitor-trial correlation.",
      trial: null,
    }),
  ]);

  assert.equal(summary.totalRuns, 3);
  assert.equal(summary.validRuns, 2);
  assert.equal(summary.verifiedRecoveries, 1);
  assert.equal(summary.rates.verifiedRecovery, 0.5);
  assert.equal(summary.runtimeOracleDisagreements, 1);
  assert.equal(summary.timing.timeToHealMs?.count, 1);
  assert.equal(summary.counts.actionCount?.mean, 1);
  assert.equal(summary.counts.successfulActionCount?.mean, 1);
  assert.equal(summary.safetyMaintainedRuns, 2);
  assert.equal(
    summary.exclusions["Ambiguous monitor-trial correlation."],
    1,
  );
  assert.equal(summary.model.callCount, 2);
  assert.equal(summary.model.tokenUsage.totalTokens?.mean, 15);
});
