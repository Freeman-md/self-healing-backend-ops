import type { ActionExecutionResult } from "@/modules/action";
import type { RecoveryDecision } from "@/modules/recovery";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type { TrialContext } from "./trial.types";
import type { TrialRecord } from "./trial.types";

export function parseStoredTrialRecord(value: unknown): TrialRecord {
  if (typeof value !== "object" || value === null) {
    throw new Error("Stored trial record must be an object.");
  }

  const record = value as Partial<TrialRecord>;

  if (
    !record.id ||
    !record.recoveryMode ||
    !record.startedAt ||
    !record.status ||
    !record.outcome ||
    !record.metrics
  ) {
    throw new Error("Stored trial record is missing required fields.");
  }

  return {
    ...record,
    id: record.id,
    triggerSource: record.triggerSource ?? "controlled",
    scenarioId: record.scenarioId,
    recoveryMode: record.recoveryMode,
    startedAt: record.startedAt,
    evidenceSnapshotIds: record.evidenceSnapshotIds ?? [],
    recoveryDecisionIds: record.recoveryDecisionIds ?? [],
    diagnosisResultIds: record.diagnosisResultIds ?? [],
    recoveryPlanIds: record.recoveryPlanIds ?? [],
    selectedActionIds: record.selectedActionIds ?? [],
    actionExecutionResultIds: record.actionExecutionResultIds ?? [],
    executedActionResultIds: record.executedActionResultIds ?? [],
    blockedActionIds: record.blockedActionIds ?? [],
    failedActionIds: record.failedActionIds ?? [],
    status: record.status,
    outcome: record.outcome,
    metrics: {
      ...record.metrics,
      actionCount: record.metrics.actionCount ?? 0,
      blockedActionCount: record.metrics.blockedActionCount ?? 0,
      failedActionCount: record.metrics.failedActionCount ?? 0,
    },
  };
}

export function recordRecoveryDecisionInTrialContext(
  context: TrialContext,
  decision: RecoveryDecision,
): void {
  context.recoveryDecisionIds.push(decision.id);
  context.diagnosisResultIds.push(decision.diagnosisResult.id);
  context.recoveryPlanIds.push(decision.recoveryPlan.id);
}

export function getOrderedRecoveryActionIds(decision: RecoveryDecision): string[] {
  return [
    ...new Set([
      ...decision.recoveryPlan.proposedActionIds,
      ...decision.recoveryPlan.fallbackActionIds,
    ]),
  ];
}

export function recordActionResultInTrialContext(
  context: TrialContext,
  actionId: string,
  result: ActionExecutionResult,
): void {
  context.selectedActionIds.push(actionId);
  context.actionAttemptCounts[actionId] = (context.actionAttemptCounts[actionId] ?? 0) + 1;
  context.actionExecutionResultIds.push(result.id);
  if (result.status === "executed") {
    context.executedActionResultIds.push(result.id);
    context.completedActionIds.push(actionId);
  } else if (result.status === "blocked") {
    context.blockedActionIds.push(actionId);
  } else if (result.status === "failed") {
    context.failedActionIds.push(actionId);
  }
}

export function recordEvidenceSnapshotInTrialContext(
  context: TrialContext,
  snapshot: EvidenceSnapshot,
): void {
  if (snapshot.id !== context.evidenceSnapshotIds.at(-1)) {
    context.evidenceSnapshotIds.push(snapshot.id);
  }
}
