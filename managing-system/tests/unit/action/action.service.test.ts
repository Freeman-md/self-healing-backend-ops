import assert from "node:assert/strict";
import { test } from "node:test";

import { ActionFactory, ActionService, type Action } from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type { SafetyRule } from "@/modules/safety";

const snapshot: EvidenceSnapshot = {
  id: "snapshot-test",
  rawEvidenceIds: [],
  createdAt: "2026-07-23T00:00:00.000Z",
  targetSystem: "managed-system",
  overallState: "healthy",
  summary: "healthy",
  signals: [],
  suspectedIncidentTypes: [],
  contradictions: [],
};

const action: Action = {
  id: "restart_postgres_container",
  name: "Restart PostgreSQL",
  description: "Restart the managed PostgreSQL container.",
  handlerKey: "restart_postgres_container",
  riskLevel: "medium",
  safetyRuleIds: [],
  expectedOutcome: {
    description: "Database connectivity is restored.",
    successCriteria: [],
  },
};

test("ActionFactory constructs blocked, failed, and successful action results", () => {
  const factory = new ActionFactory();
  const base = {
    actionId: action.id,
    trialRecordId: "trial-test",
    startedAt: snapshot.createdAt,
    safetyCheckStatus: "passed" as const,
    failedSafetyRuleIds: [],
  };

  assert.equal(factory.createBlockedActionExecutionResult({
    ...base,
    safetyCheckStatus: "failed",
    continuation: "escalated",
  }).status, "blocked");
  assert.equal(factory.createFailedActionExecutionResult(base).status, "failed");
  assert.equal(factory.createSuccessfulActionExecutionResult({
    ...base,
    continuation: "resolved",
  }).status, "executed");
});

test("ActionService routes every execution result path through ActionFactory", async () => {
  const constructedPaths: string[] = [];

  class RecordingActionFactory extends ActionFactory {
    override createBlockedActionExecutionResult(
      ...input: Parameters<ActionFactory["createBlockedActionExecutionResult"]>
    ) {
      constructedPaths.push("blocked");
      return super.createBlockedActionExecutionResult(...input);
    }

    override createFailedActionExecutionResult(
      ...input: Parameters<ActionFactory["createFailedActionExecutionResult"]>
    ) {
      constructedPaths.push("failed");
      return super.createFailedActionExecutionResult(...input);
    }

    override createSuccessfulActionExecutionResult(
      ...input: Parameters<ActionFactory["createSuccessfulActionExecutionResult"]>
    ) {
      constructedPaths.push("successful");
      return super.createSuccessfulActionExecutionResult(...input);
    }
  }

  const factory = new RecordingActionFactory();
  const allowedSafetyService = {
    evaluateActionSafety() {
      return { status: "allowed" as const, failedRuleIds: [] };
    },
  };
  const blockedSafetyService = {
    evaluateActionSafety() {
      return { status: "blocked" as const, failedRuleIds: ["max_one_attempt_per_cycle"], reason: "blocked" };
    },
  };
  const context = { trialRecordId: "trial-test" };

  await new ActionService(
    {} as never,
    blockedSafetyService as never,
    {} as never,
    factory,
  ).executeAction(action, snapshot, context);

  await new ActionService(
    { findActionHandler: () => null } as never,
    allowedSafetyService as never,
    {} as never,
    factory,
  ).executeAction(action, snapshot, context);

  await new ActionService(
    { findActionHandler: () => async () => { throw new Error("handler failed"); } } as never,
    allowedSafetyService as never,
    {} as never,
    factory,
  ).executeAction(action, snapshot, context);

  await new ActionService(
    { findActionHandler: () => async () => ({ output: "restarted" }) } as never,
    allowedSafetyService as never,
    {
      collectAndNormalize: async () => snapshot,
      saveEvidenceSnapshot: () => snapshot,
    } as never,
    factory,
    {
      async parseStructuredOutput() {
        return {
          expectedOutcomeMet: true,
          outcomeSummary: "recovered",
          matchedCriterionIds: [],
          unmetCriterionIds: [],
          continuation: "resolved" as const,
        };
      },
    } as never,
  ).executeAction(action, snapshot, context);

  assert.deepEqual(constructedPaths, ["blocked", "failed", "failed", "successful"]);
});

test("ActionService evaluates outcomes with the validated fresh snapshot and bounded resolution instructions", async () => {
  let structuredRequest: { systemPrompt: string; userPrompt: string } | undefined;
  const openaiService = {
    async parseStructuredOutput(request: { systemPrompt: string; userPrompt: string }) {
      structuredRequest = request;
      return {
        expectedOutcomeMet: true,
        outcomeSummary: "Database connectivity is restored.",
        matchedCriterionIds: [],
        unmetCriterionIds: [],
        continuation: "resolved" as const,
      };
    },
  };
  const service = new ActionService(
    {} as never,
    {} as never,
    {} as never,
    new ActionFactory(),
    openaiService as never,
  );

  await service.evaluateActionOutcome({
    expectedOutcome: action.expectedOutcome,
    evidenceSnapshot: snapshot,
  });

  assert.ok(structuredRequest);
  assert.match(structuredRequest.systemPrompt, /Return resolved when the expected outcome is met; otherwise return continue/);
  assert.deepEqual(JSON.parse(structuredRequest.userPrompt), {
    expectedOutcome: action.expectedOutcome,
    freshEvidenceSnapshot: snapshot,
  });
});

test("ActionService resolves safety rules and persists post-action evidence through EvidenceService", async () => {
  const evaluatedRules: string[][] = [];
  let persistedSnapshot: EvidenceSnapshot | undefined;
  const actionWithRule = { ...action, safetyRuleIds: ["healthy_only"] };
  const service = new ActionService(
    {
      findSafetyRuleById(ruleId: string) {
        return {
          id: ruleId,
          description: "Allow healthy evidence.",
          checkType: "evidence_state_matches" as const,
          params: { allowedStates: ["healthy"] },
          onFail: "block" as const,
        };
      },
      findActionHandler() {
        return async () => ({ output: "restarted" });
      },
    } as never,
    {
      evaluateActionSafety(_action: Action, safetyRules: SafetyRule[]) {
        evaluatedRules.push(safetyRules.map((rule: SafetyRule) => rule.id));
        return { status: "allowed" as const, failedRuleIds: [] };
      },
    } as never,
    {
      async collectAndNormalize() {
        return snapshot;
      },
      saveEvidenceSnapshot(candidate: EvidenceSnapshot) {
        persistedSnapshot = candidate;
        return candidate;
      },
    } as never,
    new ActionFactory(),
    {
      async parseStructuredOutput() {
        return {
          expectedOutcomeMet: true,
          outcomeSummary: "recovered",
          matchedCriterionIds: [],
          unmetCriterionIds: [],
          continuation: "resolved" as const,
        };
      },
    } as never,
  );

  await service.executeAction(actionWithRule, snapshot, { trialRecordId: "trial-test" });

  assert.deepEqual(evaluatedRules, [["healthy_only"]]);
  assert.equal(persistedSnapshot, snapshot);
});
