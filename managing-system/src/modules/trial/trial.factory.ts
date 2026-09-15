import { randomUUID } from "node:crypto";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type { ActionExecutionResult } from "@/modules/action";
import type { RecoveryDecision, RecoveryMode } from "@/modules/recovery";

import type { TrialContext, TrialRecord, TrialState } from "./trial.types";

export class TrialFactory {
  createTrialContext(snapshot: EvidenceSnapshot): TrialContext {
    return {
      trialRecordId: `trial-${randomUUID()}`,
      actionAttemptCounts: {},
      completedActionIds: [],
      evidenceSnapshotIds: [snapshot.id],
      recoveryDecisionIds: [],
      diagnosisResultIds: [],
      recoveryPlanIds: [],
      selectedActionIds: [],
      actionExecutionResultIds: [],
      executedActionResultIds: [],
      blockedActionIds: [],
      failedActionIds: [],
    };
  }

  createTrialStateFromDecision(decision: RecoveryDecision, snapshot: EvidenceSnapshot): TrialState {
    if (decision.status === "escalate") {
      return {
        status: "escalated",
        outcome: "unresolved_escalated",
        reason: decision.reason,
        escalationReason: decision.escalationReason,
      };
    }

    if (decision.status === "no_action") {
      return snapshot.overallState === "healthy"
        ? { status: "resolved", outcome: "resolved_safely", reason: decision.reason }
        : { status: "unresolved", outcome: "unresolved_not_escalated", reason: decision.reason };
    }

    return { status: "started", outcome: "unresolved_not_escalated", reason: decision.reason };
  }

  createTrialStateFromActionResult(result: ActionExecutionResult): TrialState {
    if (result.continuation === "resolved") {
      return {
        status: "resolved",
        outcome: "resolved_safely",
        reason: result.outcomeSummary ?? "Recovery action resolved the incident.",
      };
    }

    if (result.continuation === "escalated") {
      return {
        status: "escalated",
        outcome: "unresolved_escalated",
        reason: result.error ?? "Recovery action requires escalation.",
        escalationReason: result.error,
      };
    }

    if (result.continuation === "failed") {
      return {
        status: "failed",
        outcome: "failed",
        reason: result.error ?? "Recovery action execution failed.",
      };
    }

    if (result.continuation === "blocked") {
      return {
        status: "unresolved",
        outcome: "unresolved_not_escalated",
        reason: result.error ?? "Recovery action was blocked.",
      };
    }

    return {
      status: "unresolved",
      outcome: "unresolved_not_escalated",
      reason: result.outcomeSummary ?? "Recovery action did not yet satisfy its expected outcome.",
    };
  }

  createTrialRecord(input: {
    triggerSource?: "controlled" | "monitor";
    scenarioId?: string;
    recoveryMode: RecoveryMode;
    startedAt: string;
    completedAt: string;
    initialSnapshot: EvidenceSnapshot;
    finalSnapshot: EvidenceSnapshot;
    context: TrialContext;
    recoveryDecision: RecoveryDecision | undefined;
    trialState: TrialState;
  }): TrialRecord {
    return {
      id: input.context.trialRecordId,
      triggerSource: input.triggerSource ?? "controlled",
      scenarioId: input.scenarioId,
      recoveryMode: input.recoveryMode,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      initialEvidenceSnapshotId: input.initialSnapshot.id,
      finalEvidenceSnapshotId: input.finalSnapshot.id,
      evidenceSnapshotIds: input.context.evidenceSnapshotIds,
      recoveryDecisionIds: input.context.recoveryDecisionIds,
      diagnosisResultIds: input.context.diagnosisResultIds,
      recoveryPlanIds: input.context.recoveryPlanIds,
      diagnosisResultId: input.recoveryDecision?.diagnosisResult.id,
      recoveryPlanId: input.recoveryDecision?.recoveryPlan.id,
      selectedActionIds: input.context.selectedActionIds,
      actionExecutionResultIds: input.context.actionExecutionResultIds,
      executedActionResultIds: input.context.executedActionResultIds,
      blockedActionIds: input.context.blockedActionIds,
      failedActionIds: input.context.failedActionIds,
      status: input.trialState.status,
      outcome: input.trialState.outcome,
      escalationReason: input.trialState.escalationReason,
      metrics: {
        actionCount: input.context.actionExecutionResultIds.length,
        blockedActionCount: input.context.blockedActionIds.length,
        failedActionCount: input.context.failedActionIds.length,
        timeToRecoveryMs:
          input.trialState.status === "resolved"
            ? new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()
            : undefined,
        timeToEscalationMs:
          input.trialState.status === "escalated"
            ? new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()
            : undefined,
      },
      notes: input.trialState.reason,
    };
  }
}
