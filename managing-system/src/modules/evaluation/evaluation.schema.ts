import { z } from "zod/v4";

export const evaluationSummarySchema = z.object({
  id: z.string(),
  trialRecordId: z.string(),
  createdAt: z.string(),
  summary: z.string(),
  recoverySucceeded: z.boolean(),
  safetyMaintained: z.boolean(),
  actionEffectiveness: z.enum([
    "effective",
    "partially_effective",
    "ineffective",
    "unknown",
  ]),
  lessons: z.array(z.string()),
  recommendedChanges: z.array(z.string()),
});

export type EvaluationSummary = z.infer<typeof evaluationSummarySchema>;
export type ActionEffectiveness = EvaluationSummary["actionEffectiveness"];
