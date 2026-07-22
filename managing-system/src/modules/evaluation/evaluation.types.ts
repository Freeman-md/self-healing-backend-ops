export type ActionEffectiveness =
  | "effective"
  | "partially_effective"
  | "ineffective"
  | "unknown";

export type EvaluationSummary = {
  id: string;
  trialRecordId: string;
  createdAt: string;
  summary: string;
  recoverySucceeded: boolean;
  safetyMaintained: boolean;
  actionEffectiveness: ActionEffectiveness;
  lessons: string[];
  recommendedChanges: string[];
};
