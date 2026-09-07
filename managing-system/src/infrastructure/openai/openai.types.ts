export const OPENAI_PROMPT_VERSION = "1.0.0";

export type OpenAIInvocationOperation =
  "evidence_normalization" | "diagnosis" | "recovery_planning" | "outcome_evaluation";

export type OpenAITelemetryContext = {
  operation: OpenAIInvocationOperation;
  trialRecordId?: string;
  evidenceSnapshotId?: string;
  recoveryDecisionId?: string;
  actionExecutionResultId?: string;
};

export type OpenAIInvocationTelemetry = OpenAITelemetryContext & {
  id: string;
  model: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  status: "succeeded" | "failed";
  error: string | null;
};
