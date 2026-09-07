import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveDurations, type RecoveryMeasurement } from "@/modules/measurement";

function measurement(overrides: Partial<RecoveryMeasurement> = {}): RecoveryMeasurement {
  return {
    trialRecordId: "trial-1",
    measurementVersion: "1.0.0",
    firstUnhealthyObservedAt: "2026-08-17T10:00:00.000Z",
    firstUnhealthyEvidenceSnapshotId: "snapshot-1",
    recoveryTriggeredAt: "2026-08-17T10:00:05.000Z",
    firstActionStartedAt: "2026-08-17T10:00:08.000Z",
    recoveryVerifiedAt: "2026-08-17T10:00:20.000Z",
    completedAt: "2026-08-17T10:00:21.000Z",
    unhealthyConfirmationDelayMs: null,
    timeToFirstActionMs: null,
    recoveryLoopDurationMs: null,
    observedTimeToHealMs: null,
    decisionCount: 1,
    ...overrides,
  };
}

test("recovery durations use explicit timeline boundaries", () => {
  const result = deriveDurations(measurement());

  assert.equal(result.unhealthyConfirmationDelayMs, 5_000);
  assert.equal(result.timeToFirstActionMs, 3_000);
  assert.equal(result.recoveryLoopDurationMs, 15_000);
  assert.equal(result.observedTimeToHealMs, 20_000);
});

test("unavailable timeline boundaries remain null", () => {
  const result = deriveDurations(
    measurement({
      firstUnhealthyObservedAt: null,
      recoveryVerifiedAt: null,
    }),
  );

  assert.equal(result.unhealthyConfirmationDelayMs, null);
  assert.equal(result.recoveryLoopDurationMs, null);
  assert.equal(result.observedTimeToHealMs, null);
});
