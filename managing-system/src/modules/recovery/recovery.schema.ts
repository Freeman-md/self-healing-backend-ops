import { z } from "zod/v4";

export const incidentSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const diagnosisMethodSchema = z.enum(["deterministic", "llm"]);

export const diagnosisResultSchema = z.object({
  id: z.string(),
  evidenceSnapshotId: z.string(),
  createdAt: z.string(),
  method: diagnosisMethodSchema,
  sourceIds: z.array(z.string()),
  suspectedIncidentType: z.string(),
  severity: incidentSeveritySchema,
  confidence: z.number().min(0).max(1).nullable(),
  reasoningSummary: z.string(),
  supportingSignals: z.array(z.string()),
  contradictions: z.array(z.string()),
});

export const recoveryPlanSchema = z.object({
  id: z.string(),
  diagnosisResultId: z.string(),
  createdAt: z.string(),
  proposedActionIds: z.array(z.string()),
  rationale: z.string(),
  expectedOutcome: z.string(),
  fallbackActionIds: z.array(z.string()),
  escalationReason: z.string().nullable(),
});

export const recoveryDecisionSchema = z.object({
  id: z.string(),
  mode: z.enum(["baseline", "agent"]),
  snapshotId: z.string(),
  decidedAt: z.string(),
  status: z.enum(["no_action", "action_selected", "escalate"]),
  reason: z.string(),
  diagnosisResult: diagnosisResultSchema,
  recoveryPlan: recoveryPlanSchema,
  escalationReason: z.string().optional(),
});

export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type DiagnosisMethod = z.infer<typeof diagnosisMethodSchema>;
export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;
export type RecoveryPlan = z.infer<typeof recoveryPlanSchema>;
export type RecoveryDecision = z.infer<typeof recoveryDecisionSchema>;
