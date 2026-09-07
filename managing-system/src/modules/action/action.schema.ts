import { z } from "zod/v4";

const outcomeCriterionBase = {
  id: z.string(),
  description: z.string(),
};

export const persistedOutcomeCriterionSchema = z.discriminatedUnion("checkType", [
  z.object({
    ...outcomeCriterionBase,
    checkType: z.literal("health_status_is"),
    params: z.strictObject({
      expectedState: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
    }),
  }),
  z.object({
    ...outcomeCriterionBase,
    checkType: z.literal("endpoint_returns_status"),
    params: z.strictObject({
      endpoint: z.string().min(1),
      expectedStatus: z.number().int().min(100).max(599),
    }),
  }),
  z.object({
    ...outcomeCriterionBase,
    checkType: z.literal("metric_below_threshold"),
    params: z.strictObject({
      metric: z.string().min(1),
      threshold: z.number(),
    }),
  }),
  z.object({
    ...outcomeCriterionBase,
    checkType: z.literal("container_running"),
    params: z.strictObject({
      container: z.string().min(1),
    }),
  }),
  z.object({
    ...outcomeCriterionBase,
    checkType: z.literal("file_exists"),
    params: z.strictObject({
      path: z.string().min(1),
    }),
  }),
  z.object({
    ...outcomeCriterionBase,
    checkType: z.literal("action_completed"),
    params: z.strictObject({
      actionId: z.string().min(1),
    }),
  }),
]);

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
  continuation: z.enum(["resolved", "continue", "blocked", "escalated", "failed"]),
});

export type ActionOutcomeEvaluation = z.infer<typeof actionOutcomeEvaluationSchema>;
export type OutcomeCriterion = z.infer<typeof persistedOutcomeCriterionSchema>;
export type OutcomeCheckType = OutcomeCriterion["checkType"];
