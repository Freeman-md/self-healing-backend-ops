export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type DiagnosisResult = {
  id: string;
  evidenceSnapshotId: string;
  createdAt: string;
  suspectedIncidentType: string;
  severity: IncidentSeverity;
  confidence: number;
  reasoningSummary: string;
  supportingSignals: string[];
  contradictions: string[];
};

export type RecoveryPlan = {
  id: string;
  diagnosisResultId: string;
  createdAt: string;
  proposedActionIds: string[];
  rationale: string;
  expectedOutcome: string;
  fallbackActionIds: string[];
  escalationReason?: string;
};
