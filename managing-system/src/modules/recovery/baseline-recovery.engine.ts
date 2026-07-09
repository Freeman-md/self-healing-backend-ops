import type { BaselineRecoveryDecision, EvidenceSnapshot } from "@/types";

import { baselineRules } from "./baseline-rules";

export class BaselineRecoveryEngine {
  decide(snapshot: EvidenceSnapshot): BaselineRecoveryDecision {
    if (snapshot.overallState === "healthy") {
      return {
        mode: "baseline",
        snapshotId: snapshot.id,
        decidedAt: new Date().toISOString(),
        status: "no_action",
        reason: "Evidence snapshot is healthy, so the baseline path takes no recovery action.",
      };
    }

    for (const rule of baselineRules) {
      const match = rule.matches(snapshot);

      if (!match) {
        continue;
      }

      return {
        mode: "baseline",
        snapshotId: snapshot.id,
        decidedAt: new Date().toISOString(),
        status: "action_selected",
        selectedActionId: rule.actionId,
        reason: match.reason,
        matchedRule: {
          ruleId: rule.id,
          matchedSignalNames: match.matchedSignalNames,
          description: rule.description,
        },
      };
    }

    return {
      mode: "baseline",
      snapshotId: snapshot.id,
      decidedAt: new Date().toISOString(),
      status: "escalate",
      reason: "No fixed baseline recovery rule matched the current evidence snapshot.",
      escalationReason: "No deterministic baseline action is available for the current evidence.",
    };
  }
}
