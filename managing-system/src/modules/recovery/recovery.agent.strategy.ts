import { ActionService } from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type {
  RecoveryDecision,
  RecoveryStrategy,
  RecoveryStrategyContext,
} from "./recovery.types";

import { RecoveryAgentService } from "./recovery.agent.service";

export class RecoveryAgentStrategy implements RecoveryStrategy {
  readonly mode = "agent" as const;

  constructor(
    private readonly recoveryAgentService = new RecoveryAgentService(),
    private readonly actionService: Pick<ActionService, "listActions" | "findActionById">,
  ) {}

  async decide(
    evidenceSnapshot: EvidenceSnapshot,
    _context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision> {
    const diagnosisResult = await this.recoveryAgentService.diagnoseEvidence(evidenceSnapshot);
    const recoveryPlan = await this.recoveryAgentService.createRecoveryPlan({
      evidenceSnapshot,
      diagnosisResult,
      availableActions: this.actionService.listActions(),
    });
    const plannedActionIds = [
      ...recoveryPlan.proposedActionIds,
      ...recoveryPlan.fallbackActionIds,
    ];
    const unregisteredActionIds = plannedActionIds.filter(
      (actionId) => !this.actionService.findActionById(actionId),
    );
    const decidedAt = new Date().toISOString();

    if (unregisteredActionIds.length > 0) {
      const escalationReason =
        "Recovery planner proposed unregistered actions: " +
        unregisteredActionIds.join(", ");

      return {
        mode: this.mode,
        snapshotId: evidenceSnapshot.id,
        decidedAt,
        status: "escalate",
        reason: "The recovery plan contains actions outside the bounded action registry.",
        diagnosisResult,
        recoveryPlan,
        escalationReason,
      };
    }

    if (plannedActionIds.length === 0) {
      const escalationReason = recoveryPlan.escalationReason ?? undefined;

      return {
        mode: this.mode,
        snapshotId: evidenceSnapshot.id,
        decidedAt,
        status: escalationReason ? "escalate" : "no_action",
        reason: escalationReason
          ? "Recovery planner did not identify a bounded primary action and requested escalation."
          : "Recovery planner determined that no recovery action is required.",
        diagnosisResult,
        recoveryPlan,
        escalationReason,
      };
    }

    return {
      mode: this.mode,
      snapshotId: evidenceSnapshot.id,
      decidedAt,
      status: "action_selected",
      reason: "Self-healing agent produced a bounded recovery plan for execution.",
      diagnosisResult,
      recoveryPlan,
    };
  }
}
