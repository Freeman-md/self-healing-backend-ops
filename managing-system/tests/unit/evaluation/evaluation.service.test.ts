import assert from "node:assert/strict";
import { test } from "node:test";

import { EvaluationService } from "@/modules/evaluation";
import type { EvaluationSummary } from "@/modules/evaluation";
import type { TrialRecord } from "@/modules/trial";

const trialRecord = {
  id: "trial-evaluation-test",
  scenarioId: "evaluation-test-scenario",
  recoveryMode: "baseline",
  startedAt: "2026-07-24T00:00:00.000Z",
  evidenceSnapshotIds: [],
  selectedActionIds: [],
  executedActionResultIds: [],
  blockedActionIds: [],
  status: "resolved",
  outcome: "resolved_safely",
  metrics: { actionCount: 0, blockedActionCount: 0 },
} satisfies TrialRecord;

test("EvaluationService delegates summary construction and persistence", () => {
  const summary = {
    id: "evaluation-test",
    trialRecordId: trialRecord.id,
    createdAt: "2026-07-24T00:00:00.000Z",
    summary: "resolved",
    recoverySucceeded: true,
    safetyMaintained: true,
    actionEffectiveness: "effective",
    lessons: [],
    recommendedChanges: [],
  } satisfies EvaluationSummary;
  let createdWith: unknown;
  let savedSummary: EvaluationSummary | undefined;
  const service = new EvaluationService(
    {
      createEvaluationSummary(record: TrialRecord, reason: string) {
        createdWith = { record, reason };
        return summary;
      },
    } as never,
    {
      saveEvaluationSummary(candidate: EvaluationSummary) {
        savedSummary = candidate;
        return candidate;
      },
    } as never,
  );

  assert.equal(service.createEvaluationSummary(trialRecord, "resolved"), summary);
  assert.deepEqual(createdWith, { record: trialRecord, reason: "resolved" });
  assert.equal(service.saveEvaluationSummary(summary), summary);
  assert.equal(savedSummary, summary);
});
