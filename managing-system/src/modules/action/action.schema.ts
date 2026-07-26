import { z } from "zod/v4";

export const actionOutcomeEvaluationSchema = z.object({
  expectedOutcomeMet: z.boolean(),
  outcomeSummary: z.string(),
  matchedCriterionIds: z.array(z.string()),
  unmetCriterionIds: z.array(z.string()),
  continuation: z.enum(["resolved", "continue"]),
});

export const actionExecutionResultSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  trialRecordId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(["skipped", "blocked", "executed", "failed"]),
  safetyCheckStatus: z.enum(["passed", "failed", "not_checked"]),
  failedSafetyRuleIds: z.array(z.string()),
  beforeEvidenceSnapshotId: z.string().optional(),
  afterEvidenceSnapshotId: z.string().optional(),
  output: z.string().optional(),
  error: z.string().optional(),
  expectedOutcomeMet: z.boolean().optional(),
  outcomeSummary: z.string().optional(),
  continuation: z.enum([
    "resolved",
    "continue",
    "blocked",
    "escalated",
    "failed",
  ]),
});

export type ActionOutcomeEvaluation = z.infer<
  typeof actionOutcomeEvaluationSchema
>;
