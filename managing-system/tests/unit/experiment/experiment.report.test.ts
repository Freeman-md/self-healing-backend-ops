import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createExperimentMarkdown,
  createExperimentSummary,
  type ExperimentReport,
  type ExperimentRunReportData,
} from "@/modules/experiment";

function run(overrides: Partial<ExperimentRunReportData> = {}): ExperimentRunReportData {
  return {
    id: "run-1",
    batchId: "batch-1",
    faultProfile: "managed_system_application_stopped",
    recoveryMode: "baseline",
    repetition: 1,
    status: "completed",
    activeLockKey: null,
    startedAt: new Date("2026-08-17T10:00:00.000Z"),
    faultInjectedAt: new Date("2026-08-17T10:00:01.000Z"),
    completedAt: new Date("2026-08-17T10:00:10.000Z"),
    trialRecordId: "trial-1",
    valid: true,
    exclusionReason: null,
    runtimeResolved: true,
    oracleSucceeded: true,
    oracleFirstHealthyObservedAt: new Date("2026-08-17T10:00:08.000Z"),
    oracleCheckedAt: new Date("2026-08-17T10:00:09.000Z"),
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
  assert.equal(summary.exclusions["Ambiguous monitor-trial correlation."], 1);
  assert.equal(summary.model.callCount, 2);
  assert.equal(summary.model.tokenUsage.totalTokens?.mean, 15);
});

test("batch reports do not mislabel descriptive results as pilot evidence", () => {
  const runs = [run()];

  const report = {
    batch: {
      id: "batch-1",
      name: "canonical-recovery-suite-v1-benchmark-baseline",
      status: "completed",
      sourceRevision: "revision-1",
      measurementVersion: "1.0.0",
      configuration: {},
      requestedRepetitions: 1,
      runOrderSeed: "seed-1",
      createdAt: new Date("2026-08-17T10:00:00.000Z"),
      completedAt: new Date("2026-08-17T10:00:10.000Z"),
    },
    runs,
    summary: createExperimentSummary(runs),
  } satisfies ExperimentReport;

  const markdown = createExperimentMarkdown(report);

  assert.match(markdown, /Results are descriptive/);
  assert.doesNotMatch(markdown, /Pilot results/);
});

for (const version of ["v1", "v2"] as const) {
  test(`frozen ${version} metadata is exported without changing historical reports`, () => {
    const configuration = {
      agentStrategyVersion: version,
      agentImplementationVersion: version === "v2" ? "2.0.0" : "1.0.0",
      agentPromptVersion: version === "v2" ? "2.0.0" : "1.0.0",
    };

    const report = {
      batch: {
        id: "batch",
        name: "version test",
        sourceRevision: "head",
        measurementVersion: "1.0.0",
        configuration,
      },
      runs: [],
      summary: createExperimentSummary([]),
    } as unknown as ExperimentReport;

    const markdown = createExperimentMarkdown(report);

    assert.match(markdown, new RegExp(`Agent strategy version: ${version}`));
    assert.ok(
      markdown.includes(
        `Agent implementation version: ${configuration.agentImplementationVersion}`,
      ),
    );
    const historical = { ...report, batch: { ...report.batch, configuration: {} } };

    assert.ok(
      createExperimentMarkdown(historical).includes("not recorded (historical or baseline)"),
    );
    assert.deepEqual(historical.batch.configuration, {});
  });
}
