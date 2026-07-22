import { ActionRegistry } from "@/modules/actions";
import type {
  EvidenceSnapshot,
  RecoveryDecision,
  RecoveryStrategy,
  RecoveryStrategyContext,
} from "@/types";

import { DiagnosisAgent } from "./diagnosis-agent";
import { RecoveryPlanner } from "./recovery-planner";

export class SelfHealingAgent implements RecoveryStrategy {
  readonly mode = "agent" as const;

  constructor(
    private readonly diagnosisAgent = new DiagnosisAgent(),
    private readonly recoveryPlanner = new RecoveryPlanner(),
    private readonly actionRegistry = new ActionRegistry(),
  ) {}

  async decide(
    evidenceSnapshot: EvidenceSnapshot,
    _context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision> {
    const diagnosisResult = await this.diagnosisAgent.diagnose(evidenceSnapshot);
    const recoveryPlan = await this.recoveryPlanner.plan({
      evidenceSnapshot,
      diagnosisResult,
      availableActions: this.actionRegistry.listActions(),
    });
    const plannedActionIds = [
      ...recoveryPlan.proposedActionIds,
      ...recoveryPlan.fallbackActionIds,
    ];
    const unregisteredActionIds = plannedActionIds.filter(
      (actionId) => !this.actionRegistry.findActionById(actionId),
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
