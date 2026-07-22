import { z } from "zod/v4";

export const actionOutcomeEvaluationSchema = z.object({
  expectedOutcomeMet: z.boolean(),
  outcomeSummary: z.string(),
  matchedCriterionIds: z.array(z.string()),
  unmetCriterionIds: z.array(z.string()),
  continuation: z.enum(["resolved", "continue"]),
});

export type ActionOutcomeEvaluation = z.infer<
  typeof actionOutcomeEvaluationSchema
>;
