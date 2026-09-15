import { z } from "zod/v4";
import {
  diagnosisResultSchema,
  recoveryPlanSchema,
  recoveryDecisionSchema,
} from "../../recovery.schema";

export const agentV2DecisionSchema = z.strictObject({
  diagnosisResult: diagnosisResultSchema
    .pick({
      suspectedIncidentType: true,
      severity: true,
      confidence: true,
      reasoningSummary: true,
      supportingSignals: true,
      contradictions: true,
    })
    .strict(),
  recoveryPlan: recoveryPlanSchema
    .pick({
      proposedActionIds: true,
      fallbackActionIds: true,
      rationale: true,
      expectedOutcome: true,
      escalationReason: true,
    })
    .strict(),
  status: recoveryDecisionSchema.shape.status,
  reason: recoveryDecisionSchema.shape.reason,
  escalationReason: z.string().nullable(),
});
export type AgentV2Decision = z.infer<typeof agentV2DecisionSchema>;
