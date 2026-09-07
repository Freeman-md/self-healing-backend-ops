import assert from "node:assert/strict";
import { test } from "node:test";

import type { Action } from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { RecoveryAgentStrategy } from "@/modules/recovery";

const snapshot: EvidenceSnapshot = {
  id: "snapshot-agent-strategy-test",
  rawEvidenceIds: [],
  createdAt: "2026-07-24T00:00:00.000Z",
  targetSystem: "managed-system",
  overallState: "unhealthy",
  summary: "Database unavailable.",
  signals: [],
  suspectedIncidentTypes: ["database_connectivity_failure"],
  contradictions: [],
};

const action: Action = {
  id: "restart_postgres_container",
  name: "Restart PostgreSQL",
  description: "Restart the managed PostgreSQL container.",
  handlerKey: "restart_postgres_container",
  riskLevel: "medium",
  safetyRuleIds: [],
  expectedOutcome: { description: "Database restored.", successCriteria: [] },
};

test("RecoveryAgentStrategy obtains and validates planned actions through ActionService", async () => {
  const requestedActionIds: string[] = [];

  const strategy = new RecoveryAgentStrategy(
    {
      async diagnoseEvidence() {
        return {
          id: "diagnosis-agent-test",
          evidenceSnapshotId: snapshot.id,
          createdAt: snapshot.createdAt,
          method: "llm" as const,
          sourceIds: [],
          suspectedIncidentType: "database_connectivity_failure",
          severity: "high" as const,
          confidence: 0.9,
          reasoningSummary: "Database is unavailable.",
          supportingSignals: [],
          contradictions: [],
        };
      },
      async createRecoveryPlan(input: { availableActions: Action[] }) {
        assert.deepEqual(input.availableActions, [action]);

        return {
          id: "recovery-plan-agent-test",
          diagnosisResultId: "diagnosis-agent-test",
          createdAt: snapshot.createdAt,
          proposedActionIds: [action.id],
          rationale: "Restart the database.",
          expectedOutcome: "Database restored.",
          fallbackActionIds: [],
          escalationReason: null,
        };
      },
    } as never,
    {
      listActions() {
        return [action];
      },
      findActionById(actionId: string) {
        requestedActionIds.push(actionId);

        return actionId === action.id ? action : null;
      },
    } as never,
  );

  const decision = await strategy.decide(snapshot, {
    actionAttemptCounts: {},
    completedActionIds: [],
  });

  assert.equal(decision.status, "action_selected");
  assert.deepEqual(requestedActionIds, [action.id]);
});

test("constructing the unused agent strategy does not require OpenAI configuration", () => {
  assert.doesNotThrow(() => {
    new RecoveryAgentStrategy(undefined, {
      listActions: () => [],
      findActionById: () => null,
    } as never);
  });
});
