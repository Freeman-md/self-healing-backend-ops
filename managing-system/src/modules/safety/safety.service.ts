import { ActionRepository, type Action } from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";

import type {
  SafetyDecision,
  SafetyRule,
  SafetyRuleEvaluation,
} from "./safety.types";

type SafetyContext = {
  evidenceSnapshot: EvidenceSnapshot;
  actionAttemptCounts?: Record<string, number>;
  completedActionIds?: string[];
  manualApprovalGranted?: boolean;
};

export class SafetyService {
  constructor(private readonly actionRepository = new ActionRepository()) {}

  evaluateActionSafety(action: Action, context: SafetyContext): SafetyDecision {
    const evaluations: SafetyRuleEvaluation[] = [];

    for (const ruleId of action.safetyRuleIds) {
      const rule = this.actionRepository.findSafetyRuleById(ruleId);

      if (!rule) {
        evaluations.push({
          ruleId,
          status: "failed",
          reason: "Referenced safety rule was not found in the action registry.",
          onFail: "escalate",
        });

        continue;
      }

      evaluations.push(this.evaluateRule(rule, action, context));
    }

    const failedEvaluations = evaluations.filter((evaluation) => evaluation.status === "failed");

    if (failedEvaluations.length === 0) {
      return {
        actionId: action.id,
        checkedAt: new Date().toISOString(),
        status: "allowed",
        passedRuleIds: evaluations.map((evaluation) => evaluation.ruleId),
        failedRuleIds: [],
        reason: "All safety rules passed for the selected action.",
        evaluations,
      };
    }

    const shouldEscalate = failedEvaluations.some((evaluation) => evaluation.onFail === "escalate");

    return {
      actionId: action.id,
      checkedAt: new Date().toISOString(),
      status: shouldEscalate ? "escalate" : "blocked",
      passedRuleIds: evaluations
        .filter((evaluation) => evaluation.status === "passed")
        .map((evaluation) => evaluation.ruleId),
      failedRuleIds: failedEvaluations.map((evaluation) => evaluation.ruleId),
      reason: shouldEscalate
        ? "At least one safety rule failed with escalation required."
        : "At least one safety rule failed, so the action is blocked.",
      evaluations,
      escalationReason: shouldEscalate
        ? "Safety gate requires escalation before the selected action can proceed."
        : undefined,
    };
  }

  private evaluateRule(
    rule: SafetyRule,
    action: Action,
    context: SafetyContext,
  ): SafetyRuleEvaluation {
    switch (rule.checkType) {
      case "evidence_state_matches": {
        const allowedStates = Array.isArray(rule.params.allowedStates)
          ? rule.params.allowedStates.filter((item): item is string => typeof item === "string")
          : [];
        const passed = allowedStates.includes(context.evidenceSnapshot.overallState);

        return {
          ruleId: rule.id,
          status: passed ? "passed" : "failed",
          reason: passed
            ? "Evidence state is allowed for the selected action."
            : `Evidence state ${context.evidenceSnapshot.overallState} is not allowed for the selected action.`,
          onFail: rule.onFail,
        };
      }

      case "max_attempts_not_exceeded": {
        const maxAttempts =
          typeof rule.params.maxAttempts === "number" ? rule.params.maxAttempts : Number.POSITIVE_INFINITY;
        const currentAttempts = context.actionAttemptCounts?.[action.id] ?? 0;
        const passed = currentAttempts < maxAttempts;

        return {
          ruleId: rule.id,
          status: passed ? "passed" : "failed",
          reason: passed
            ? "Action attempt count is within the allowed limit."
            : `Action attempt count ${currentAttempts} exceeds or meets the limit ${maxAttempts}.`,
          onFail: rule.onFail,
        };
      }

      case "manual_approval_required": {
        const passed = context.manualApprovalGranted === true;

        return {
          ruleId: rule.id,
          status: passed ? "passed" : "failed",
          reason: passed
            ? "Manual approval has been granted for this action."
            : "Manual approval has not been granted for this action.",
          onFail: rule.onFail,
        };
      }

      case "previous_action_completed": {
        const requiredActionId =
          typeof rule.params.requiredActionId === "string" ? rule.params.requiredActionId : "";
        const passed = context.completedActionIds?.includes(requiredActionId) ?? false;

        return {
          ruleId: rule.id,
          status: passed ? "passed" : "failed",
          reason: passed
            ? "Required previous action has been completed."
            : `Required previous action ${requiredActionId} has not been completed.`,
          onFail: rule.onFail,
        };
      }

      case "previous_action_not_run": {
        const blockedActionId =
          typeof rule.params.blockedActionId === "string" ? rule.params.blockedActionId : "";
        const passed = !(context.completedActionIds?.includes(blockedActionId) ?? false);

        return {
          ruleId: rule.id,
          status: passed ? "passed" : "failed",
          reason: passed
            ? "Blocked previous action has not been run in the current context."
            : `Blocked previous action ${blockedActionId} has already been run.`,
          onFail: rule.onFail,
        };
      }

      case "file_exists":
      case "file_missing":
        return {
          ruleId: rule.id,
          status: "failed",
          reason: `Safety check type ${rule.checkType} is not implemented.`,
          onFail: "escalate",
        };

      default:
        return {
          ruleId: rule.id,
          status: "failed",
          reason: `Unsupported safety check type ${(rule as SafetyRule).checkType}.`,
          onFail: "escalate",
        };
    }
  }
}
