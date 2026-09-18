import type { EvidenceSnapshot } from "@/modules/evidence";
import type { ControlledRecoveryEnvironment } from "../../recovery.types";
import type { AgentV2Decision } from "./recovery.agent-v2.schema";

export function validateDecision(
  decision: AgentV2Decision,
  snapshot: EvidenceSnapshot,
  environment: ControlledRecoveryEnvironment,
  toolName: string,
): string | undefined {
  const expectedStatus =
    toolName === "record_recovery_decision"
      ? "action_selected"
      : toolName === "complete_recovery"
        ? "no_action"
        : "escalate";

  if (decision.status !== expectedStatus) {
    return "Decision status does not match the selected tool.";
  }

  const { proposedActionIds, fallbackActionIds } = decision.recoveryPlan;

  const actions = [...proposedActionIds, ...fallbackActionIds];

  const lists = [
    actions,
    decision.diagnosisResult.supportingSignals,
    decision.diagnosisResult.contradictions,
  ];

  if (lists.some((list) => new Set(list).size !== list.length)) {
    return "Decision lists must not contain duplicates.";
  }

  if (actions.some((actionId) => !environment.actions.some((action) => action.id === actionId))) {
    return "Plan contains an unregistered action.";
  }

  if (
    decision.diagnosisResult.supportingSignals.some(
      (name) => name === "[redacted]" || !snapshot.signals.some((signal) => signal.name === name),
    )
  ) {
    return "Supporting signals must exist in the current snapshot.";
  }

  if (decision.status === "action_selected" && proposedActionIds.length === 0) {
    return "An action-selected decision requires a proposed action.";
  }

  if (decision.status === "no_action" && actions.length > 0) {
    return "A no-action decision cannot propose actions.";
  }

  if (
    decision.status === "escalate" &&
    (!decision.escalationReason?.trim() || !decision.recoveryPlan.escalationReason?.trim())
  ) {
    return "Escalation requires decision and plan reasons.";
  }

  return undefined;
}
