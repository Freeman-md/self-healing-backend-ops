import { z } from "zod/v4";

import {
  diagnosisMethodSchema,
  diagnosisResultSchema,
  incidentSeveritySchema,
  recoveryPlanSchema,
} from "@/schemas";
import type { EvidenceSnapshot } from "@/types/evidence";
import type { RecoveryMode } from "@/types/trials";

export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;

export type DiagnosisMethod = z.infer<typeof diagnosisMethodSchema>;

export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;

export type RecoveryPlan = z.infer<typeof recoveryPlanSchema>;

export type RecoveryDecisionStatus = "no_action" | "action_selected" | "escalate";

export type RecoveryDecision = {
  mode: RecoveryMode;
  snapshotId: string;
  decidedAt: string;
  status: RecoveryDecisionStatus;
  reason: string;
  diagnosisResult: DiagnosisResult;
  recoveryPlan: RecoveryPlan;
  escalationReason?: string;
};

export type RecoveryStrategyContext = {
  actionAttemptCounts: Record<string, number>;
  completedActionIds: string[];
};

export interface RecoveryStrategy {
  readonly mode: RecoveryMode;

  decide(
    snapshot: EvidenceSnapshot,
    context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision>;
}
