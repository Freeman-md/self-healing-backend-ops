import { ActionService } from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type {
  RecoveryDecision,
  RecoveryStrategy,
  RecoveryStrategyContext,
} from "./recovery.types";

import { RecoveryAgentService } from "./recovery.agent.service";
import { RecoveryFactory } from "./recovery.factory";

export class RecoveryAgentStrategy implements RecoveryStrategy {
  readonly mode = "agent" as const;

  constructor(
    private readonly recoveryAgentService = new RecoveryAgentService(),
    private readonly actionService: Pick<ActionService, "listActions" | "findActionById">,
    private readonly recoveryFactory = new RecoveryFactory(),
  ) {}

  async decide(
    evidenceSnapshot: EvidenceSnapshot,
    _context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision> {
    const diagnosisResult = await this.recoveryAgentService.diagnoseEvidence(evidenceSnapshot);
    const availableActions = await this.actionService.listActions();
    const recoveryPlan = await this.recoveryAgentService.createRecoveryPlan({
      evidenceSnapshot,
      diagnosisResult,
      availableActions,
    });
    const plannedActionIds = [
      ...recoveryPlan.proposedActionIds,
      ...recoveryPlan.fallbackActionIds,
    ];
    const registeredActions = await Promise.all(
      plannedActionIds.map((actionId) => this.actionService.findActionById(actionId)),
    );
    const unregisteredActionIds = plannedActionIds.filter(
      (_actionId, position) => !registeredActions[position],
    );
    if (unregisteredActionIds.length > 0) {
      const escalationReason =
        "Recovery planner proposed unregistered actions: " +
        unregisteredActionIds.join(", ");

      return this.recoveryFactory.createRecoveryDecision({
        mode: this.mode,
        snapshot: evidenceSnapshot,
        status: "escalate",
        reason: "The recovery plan contains actions outside the bounded action registry.",
        diagnosisResult,
        recoveryPlan,
        escalationReason,
      });
    }

    if (plannedActionIds.length === 0) {
      const escalationReason = recoveryPlan.escalationReason ?? undefined;

      return this.recoveryFactory.createRecoveryDecision({
        mode: this.mode,
        snapshot: evidenceSnapshot,
        status: escalationReason ? "escalate" : "no_action",
        reason: escalationReason
          ? "Recovery planner did not identify a bounded primary action and requested escalation."
          : "Recovery planner determined that no recovery action is required.",
        diagnosisResult,
        recoveryPlan,
        escalationReason,
      });
    }

    return this.recoveryFactory.createRecoveryDecision({
      mode: this.mode,
      snapshot: evidenceSnapshot,
      status: "action_selected",
      reason: "Self-healing agent produced a bounded recovery plan for execution.",
      diagnosisResult,
      recoveryPlan,
    });
  }
}
