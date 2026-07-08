export type RawEvidenceSource =
  | "health"
  | "metrics"
  | "logs"
  | "business-endpoint"
  | "container";

export type RawEvidenceStatus = "collected" | "failed";

export type EvidenceSignalStatus = "normal" | "warning" | "critical" | "unknown";

export type EvidenceSnapshotState = "healthy" | "degraded" | "unhealthy" | "unknown";

export type RawEvidence = {
  id: string;
  source: RawEvidenceSource;
  target: string;
  collectedAt: string;
  status: RawEvidenceStatus;
  rawText?: string;
  error?: string;
};

export type EvidenceSignal = {
  source: RawEvidenceSource;
  name: string;
  status: EvidenceSignalStatus;
  value?: string | number | boolean;
  description: string;
};

export type EvidenceSnapshot = {
  id: string;
  rawEvidenceIds: string[];
  createdAt: string;
  targetSystem: "managed-system";
  overallState: EvidenceSnapshotState;
  summary: string;
  signals: EvidenceSignal[];
  suspectedIncidentTypes: string[];
  contradictions: string[];
};
