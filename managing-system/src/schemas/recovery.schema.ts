import { z } from "zod/v4";

export const incidentSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const diagnosisResultSchema = z.object({
  id: z.string(),
  evidenceSnapshotId: z.string(),
  createdAt: z.string(),
  suspectedIncidentType: z.string(),
  severity: incidentSeveritySchema,
  confidence: z.number().min(0).max(1),
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
