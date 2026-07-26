import assert from "node:assert/strict";
import { test } from "node:test";

import type { EvidenceSnapshot } from "@/modules/evidence";
import {
  RecoveryBaselineStrategy,
  findMatchingBaselineRule,
  type BaselineRule,
  type RecoveryFactory,
} from "@/modules/recovery";

const baselineRules: BaselineRule[] = [
  {
    id: "database_connectivity_failure",
    description: "database first",
    incidentType: "database_connectivity_failure",
    severity: "high",
    expectedOutcome: "healthy",
    priority: 100,
    version: 1,
    proposedActionIds: ["restart_postgres_container"],
    fallbackActionIds: [],
    conditionGroups: [{
      matchMode: "ANY",
      conditions: [
        {
          signalCode: "postgres_container_state",
          operator: "EQUALS",
          expectedStatus: "critical",
        },
        {
          signalCode: "database_connectivity",
          operator: "EQUALS",
          expectedStatus: "critical",
        },
      ],
    }],
  },
];

const baselineRuleSource = {
  async findMatchingBaselineRule(snapshot: EvidenceSnapshot) {
    return findMatchingBaselineRule(snapshot, baselineRules);
  },
};

function createSnapshot(
  overallState: EvidenceSnapshot["overallState"],
  suspectedIncidentTypes: EvidenceSnapshot["suspectedIncidentTypes"] = [],
): EvidenceSnapshot {
  return {
    id: `snapshot-${overallState}`,
    rawEvidenceIds: [],
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    overallState,
    summary: overallState,
    signals: suspectedIncidentTypes.includes("database_connectivity_failure")
      ? [{
        source: "health",
        name: "database_connectivity",
        code: "database_connectivity",
        status: "critical",
        value: false,
        description: "Database connectivity failed.",
        method: "deterministic",
      }]
      : [],
    suspectedIncidentTypes,
    contradictions: [],
  };
}

test("baseline rules select only the PostgreSQL restart for database evidence", () => {
  const match = findMatchingBaselineRule(
    createSnapshot("unhealthy", ["database_connectivity_failure"]),
    baselineRules,
  );

  assert.deepEqual(match?.rule.proposedActionIds, ["restart_postgres_container"]);
  assert.deepEqual(match?.rule.fallbackActionIds, []);
});

test("baseline strategy retains healthy and unmatched escalation decisions", async () => {
  const strategy = new RecoveryBaselineStrategy(baselineRuleSource);
  const context = { actionAttemptCounts: {}, completedActionIds: [] };

  const healthy = await strategy.decide(createSnapshot("healthy"), context);
  const unmatched = await strategy.decide(
    createSnapshot("unknown", ["unclassified"]),
    context,
  );

  assert.equal(healthy.status, "no_action");
  assert.equal(unmatched.status, "escalate");
});

test("baseline strategy delegates deterministic construction to RecoveryFactory", async () => {
  const calls: string[] = [];
  const factory = {
    createDiagnosisResult(input: Record<string, unknown>) {
      calls.push("diagnosis");
      return { ...input, id: "diagnosis-test", createdAt: "2026-07-23T00:00:00.000Z" };
    },
    createRecoveryPlan(input: Record<string, unknown>) {
      calls.push("plan");
      return { ...input, id: "plan-test", createdAt: "2026-07-23T00:00:00.000Z" };
    },
    createRecoveryDecision(input: Record<string, unknown>) {
      calls.push("decision");
      return {
        ...input,
        snapshotId: (input.snapshot as EvidenceSnapshot).id,
        decidedAt: "2026-07-23T00:00:00.000Z",
      };
    },
  } as unknown as RecoveryFactory;
  const strategy = new RecoveryBaselineStrategy(baselineRuleSource, factory);

  const decision = await strategy.decide(
    createSnapshot("unhealthy", ["database_connectivity_failure"]),
    { actionAttemptCounts: {}, completedActionIds: [] },
  );

  assert.equal(decision.status, "action_selected");
  assert.deepEqual(calls, ["diagnosis", "plan", "decision"]);
});

test("unsupported baseline operators fail safely", () => {
  const invalidRules = structuredClone(baselineRules);
  invalidRules[0]!.conditionGroups[0]!.conditions[0]!.operator =
    "UNSUPPORTED" as "EQUALS";

  assert.throws(
    () =>
      findMatchingBaselineRule(
        createSnapshot("unhealthy", ["database_connectivity_failure"]),
        invalidRules,
      ),
    /Unsupported baseline operator/,
  );
});
