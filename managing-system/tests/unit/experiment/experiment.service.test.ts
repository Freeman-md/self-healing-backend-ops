import assert from "node:assert/strict";
import { test } from "node:test";
import { ExperimentService, type ExperimentRun } from "@/modules/experiment";

function experimentRun(): ExperimentRun {
  return {
    id: "run-1",
    batchId: "batch-1",
    faultProfile: "managed_system_application_stopped",
    recoveryMode: "baseline",
    repetition: 1,
    status: "fault_injected",
    startedAt: "2026-08-17T10:00:00.000Z",
    faultInjectedAt: "2026-08-17T10:00:01.000Z",
    completedAt: null,
    trialRecordId: null,
    valid: null,
    exclusionReason: null,
    runtimeResolved: null,
    oracleSucceeded: null,
    oracleCheckedAt: null,
    oracleDetails: null,
    stabilityWindowMs: 1_000,
    diagnosisCorrect: null,
    actionSequenceCorrect: null,
    unnecessaryActionCount: null,
    faultToDetectionMs: null,
    timeToHealMs: null,
    timeToTerminationMs: null,
  };
}

test("post-run correlation rejects multiple monitor trials instead of guessing", async () => {
  let invalidReason = "";
  const candidate = {
    id: "trial-1",
    startedAt: "2026-08-17T10:00:02.000Z",
    completedAt: "2026-08-17T10:00:03.000Z",
    status: "resolved",
    recoveryMode: "baseline" as const,
    measurement: null,
    diagnosisIncidentCodes: [],
    actionIds: [],
  };
  const service = new ExperimentService(
    {
      findCompletedMonitorTrials: () => [candidate, { ...candidate, id: "trial-2" }],
      invalidateExperimentRun(_runId: string, reason: string) {
        invalidReason = reason;
        return experimentRun();
      },
    } as never,
    { now: () => 0, sleep: async () => undefined },
  );

  await assert.rejects(
    () => service.waitForAndLinkMonitorTrial(experimentRun()),
    /Expected one monitor-triggered trial but found 2/,
  );
  assert.match(invalidReason, /found 2/);
});
