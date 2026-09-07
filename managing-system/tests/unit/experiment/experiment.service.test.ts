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
    activeLockKey: "global",
    startedAt: new Date("2026-08-17T10:00:00.000Z"),
    faultInjectedAt: new Date("2026-08-17T10:00:01.000Z"),
    completedAt: null,
    trialRecordId: null,
    valid: null,
    exclusionReason: null,
    runtimeResolved: null,
    oracleSucceeded: null,
    oracleFirstHealthyObservedAt: null,
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

test("time to heal ends at the first independently healthy observation", async () => {
  let completedInput: { timeToHealMs: number | null } | undefined;

  const run = experimentRun();

  const service = new ExperimentService({
    completeExperimentRun(input: { timeToHealMs: number | null }) {
      completedInput = input;

      return run;
    },
  } as never);

  await service.completeExperimentRun({
    run,
    trial: {
      id: "trial-1",
      startedAt: "2026-08-17T10:00:02.000Z",
      completedAt: "2026-08-17T10:00:10.000Z",
      status: "resolved",
      recoveryMode: "baseline",
      measurement: null,
      diagnosisIncidentCodes: ["managed_system_unreachable"],
      actionIds: ["restart_managed_system_service"],
    },
    oracle: {
      succeeded: true,
      firstHealthyObservedAt: "2026-08-17T10:00:08.000Z",
      checkedAt: "2026-08-17T10:00:18.000Z",
      details: {},
    },
  });

  assert.equal(completedInput?.timeToHealMs, 7_000);
});

test("campaign failure marks its batch failed and preserves the original error", async () => {
  let completion: { batchId: string; status: string } | undefined;

  const campaignError = new Error("campaign failed");

  const service = new ExperimentService({
    async completeExperimentBatch(batchId: string, status: string) {
      completion = { batchId, status };

      return {};
    },
  } as never);

  await assert.rejects(
    () => service.failExperimentBatch("batch-1", campaignError),
    (error: unknown) => error === campaignError,
  );
  assert.deepEqual(completion, { batchId: "batch-1", status: "failed" });
});
