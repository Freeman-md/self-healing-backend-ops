import { ActionRegistry } from "@/modules/actions";
import type { EvidenceSnapshot, SelfHealingAgentDecision } from "@/types";

import { DiagnosisAgent } from "./diagnosis-agent";
import { RecoveryPlanner } from "./recovery-planner";

type SelfHealingAgentContext = {
  actionAttemptCounts?: Record<string, number>;
  completedActionIds?: string[];
  manualApprovalGranted?: boolean;
};

export class SelfHealingAgent {
  constructor(
    private readonly diagnosisAgent = new DiagnosisAgent(),
    private readonly recoveryPlanner = new RecoveryPlanner(),
    private readonly actionRegistry = new ActionRegistry(),
  ) {}

  async run(
    evidenceSnapshot: EvidenceSnapshot,
    context: SelfHealingAgentContext = {},
  ): Promise<SelfHealingAgentDecision> {
    const diagnosisResult = await this.diagnosisAgent.diagnose(evidenceSnapshot);
    const recoveryPlan = await this.recoveryPlanner.plan({
      evidenceSnapshot,
      diagnosisResult,
      availableActions: this.actionRegistry.listActions(),
    });
    const selectedActionId = recoveryPlan.proposedActionIds[0] ?? recoveryPlan.fallbackActionIds[0];
    const decidedAt = new Date().toISOString();

    if (!selectedActionId) {
      const escalationReason = recoveryPlan.escalationReason ?? "No bounded action was proposed by the recovery planner.";

      return {
        mode: "agent",
        snapshotId: evidenceSnapshot.id,
        decidedAt,
        status: recoveryPlan.escalationReason ? "escalate" : "no_action",
        reason: recoveryPlan.escalationReason
          ? "Recovery planner could not identify a bounded action and requested escalation."
          : "Recovery planner did not propose any bounded action.",
        diagnosisResult,
        recoveryPlan,
        escalationReason,
      };
    }

    const selectedAction = this.actionRegistry.findActionById(selectedActionId);

    if (!selectedAction) {
      return {
        mode: "agent",
        snapshotId: evidenceSnapshot.id,
        decidedAt,
        status: "escalate",
        reason: "Recovery planner proposed an action that is not present in the action registry.",
        diagnosisResult,
        recoveryPlan,
        selectedActionId,
        escalationReason: `Unregistered action proposed: ${selectedActionId}`,
      };
    }

    return {
      mode: "agent",
      snapshotId: evidenceSnapshot.id,
      decidedAt,
      status: "planned",
      reason: "Self-healing agent produced a bounded action for execution-time safety evaluation.",
      diagnosisResult,
      recoveryPlan,
      selectedActionId: selectedAction.id,
    };
  }
}
