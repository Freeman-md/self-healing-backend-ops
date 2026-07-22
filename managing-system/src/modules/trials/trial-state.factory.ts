import type { ActionExecutionResult } from "@/modules/actions";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type { RecoveryDecision } from "@/modules/recovery";

import type { TrialState } from "./trial.types";

export class TrialStateFactory {
  fromDecision(
    decision: RecoveryDecision,
    snapshot: EvidenceSnapshot,
  ): TrialState {
    if (decision.status === "escalate") {
      return {
        status: "escalated",
        outcome: "unresolved_escalated",
        reason: decision.reason,
        escalationReason: decision.escalationReason,
      };
    }

    if (decision.status === "no_action") {
      return {
        status: snapshot.overallState === "healthy" ? "resolved" : "unresolved",
        outcome:
          snapshot.overallState === "healthy"
            ? "resolved_safely"
            : "unresolved_not_escalated",
        reason: decision.reason,
      };
    }

    return {
      status: "started",
      outcome: "unresolved_not_escalated",
      reason: decision.reason,
    };
  }

  fromExecutionResult(result: ActionExecutionResult): TrialState {
    switch (result.continuation) {
      case "resolved":
        return {
          status: "resolved",
          outcome: "resolved_safely",
          reason: result.outcomeSummary ?? "Recovery action resolved the incident.",
        };
      case "blocked":
        return {
          status: "unresolved",
          outcome: "unresolved_not_escalated",
          reason: result.error ?? "Recovery action was blocked.",
        };
      case "escalated":
        return {
          status: "escalated",
          outcome: "unresolved_escalated",
          reason: result.error ?? "Recovery action requires escalation.",
          escalationReason: result.error,
        };
      case "failed":
        return {
          status: "failed",
          outcome: "failed",
          reason: result.error ?? "Recovery action execution failed.",
        };
      case "continue":
        return {
          status: "unresolved",
          outcome: "unresolved_not_escalated",
          reason:
            result.outcomeSummary ??
            "Recovery action did not yet satisfy its expected outcome.",
        };
    }
  }
}
