import type { ActionExecutionResult } from "@/modules/action";
import type { RecoveryDecision } from "@/modules/recovery";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type { TrialContext } from "./trial.types";

export function getOrderedRecoveryActionIds(decision: RecoveryDecision): string[] {
  return [...new Set([...decision.recoveryPlan.proposedActionIds, ...decision.recoveryPlan.fallbackActionIds])];
}
export function recordActionResultInTrialContext(context: TrialContext, actionId: string, result: ActionExecutionResult): void {
  context.selectedActionIds.push(actionId);
  context.actionAttemptCounts[actionId] = (context.actionAttemptCounts[actionId] ?? 0) + 1;
  if (result.status === "executed") { context.executedActionResultIds.push(result.id); context.completedActionIds.push(actionId); }
  else context.blockedActionIds.push(actionId);
}
export function recordEvidenceSnapshotInTrialContext(context: TrialContext, snapshot: EvidenceSnapshot): void {
  if (snapshot.id !== context.evidenceSnapshotIds.at(-1)) context.evidenceSnapshotIds.push(snapshot.id);
}
