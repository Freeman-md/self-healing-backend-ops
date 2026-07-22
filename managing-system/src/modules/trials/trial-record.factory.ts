import type { EvidenceSnapshot } from "@/modules/evidence";
import type { RecoveryDecision, RecoveryMode } from "@/modules/recovery";

import type { TrialContext, TrialRecord, TrialState } from "./trial.types";

export class TrialRecordFactory {
  create(input: {
    scenarioId: string;
    recoveryMode: RecoveryMode;
    startedAt: string;
    completedAt: string;
    initialSnapshot: EvidenceSnapshot;
    finalSnapshot: EvidenceSnapshot;
    context: TrialContext;
    recoveryDecision: RecoveryDecision;
    trialState: TrialState;
  }): TrialRecord {
    return {
      id: input.context.trialRecordId,
      scenarioId: input.scenarioId,
      recoveryMode: input.recoveryMode,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      initialEvidenceSnapshotId: input.initialSnapshot.id,
      finalEvidenceSnapshotId: input.finalSnapshot.id,
      evidenceSnapshotIds: input.context.evidenceSnapshotIds,
      diagnosisResultId: input.recoveryDecision.diagnosisResult.id,
      recoveryPlanId: input.recoveryDecision.recoveryPlan.id,
      selectedActionIds: input.context.selectedActionIds,
      executedActionResultIds: input.context.executedActionResultIds,
      blockedActionIds: input.context.blockedActionIds,
      status: input.trialState.status,
      outcome: input.trialState.outcome,
      escalationReason: input.trialState.escalationReason,
      metrics: {
        actionCount:
          input.context.executedActionResultIds.length +
          input.context.blockedActionIds.length,
        blockedActionCount: input.context.blockedActionIds.length,
        timeToRecoveryMs:
          input.trialState.status === "resolved"
            ? new Date(input.completedAt).getTime() -
              new Date(input.startedAt).getTime()
            : undefined,
        timeToEscalationMs:
          input.trialState.status === "escalated"
            ? new Date(input.completedAt).getTime() -
              new Date(input.startedAt).getTime()
            : undefined,
      },
      notes: input.trialState.reason,
    };
  }
}
