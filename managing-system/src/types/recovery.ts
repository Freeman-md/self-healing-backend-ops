import { z } from "zod/v4";

import {
  diagnosisResultSchema,
  incidentSeveritySchema,
  recoveryPlanSchema,
} from "@/schemas";
import type { SafetyGateDecision } from "@/types/actions";

export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;

export type BaselineRecoveryDecisionStatus = "no_action" | "action_selected" | "escalate";

export type BaselineRuleMatch = {
  ruleId: string;
  matchedSignalNames: string[];
  description: string;
};

export type BaselineRecoveryDecision = {
  mode: "baseline";
  snapshotId: string;
  decidedAt: string;
  status: BaselineRecoveryDecisionStatus;
  reason: string;
  selectedActionId?: string;
  escalationReason?: string;
  matchedRule?: BaselineRuleMatch;
};

export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;

export type RecoveryPlan = z.infer<typeof recoveryPlanSchema>;

export type SelfHealingAgentDecisionStatus = "planned" | "blocked" | "escalate" | "no_action";

export type SelfHealingAgentDecision = {
  mode: "agent";
  snapshotId: string;
  decidedAt: string;
  status: SelfHealingAgentDecisionStatus;
  reason: string;
  diagnosisResult: DiagnosisResult;
  recoveryPlan: RecoveryPlan;
  selectedActionId?: string;
  safetyGateDecision?: SafetyGateDecision;
  escalationReason?: string;
};
