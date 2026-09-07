import { randomUUID } from "node:crypto";

import type { TrialRecord } from "@/modules/trial";

import type { EvaluationSummary } from "./evaluation.types";

export class EvaluationFactory {
  createEvaluationSummary(trialRecord: TrialRecord, summaryReason: string): EvaluationSummary {
    return {
      id: `evaluation-${randomUUID()}`,
      trialRecordId: trialRecord.id,
      createdAt: new Date().toISOString(),
      summary: summaryReason,
      recoverySucceeded: trialRecord.status === "resolved",
      safetyMaintained: trialRecord.outcome !== "resolved_unsafely",
      actionEffectiveness: trialRecord.status === "resolved" ? "effective" : "unknown",
      lessons: [],
      recommendedChanges: [],
    };
  }
}
