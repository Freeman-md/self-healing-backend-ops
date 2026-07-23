import assert from "node:assert/strict";
import { test } from "node:test";

import type { EvidenceSnapshot } from "@/modules/evidence";
import { RecoveryBaselineStrategy, findMatchingBaselineRule } from "@/modules/recovery";

function createSnapshot(
  overallState: EvidenceSnapshot["overallState"],
  suspectedIncidentTypes: string[] = [],
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
        status: "critical",
        value: false,
        description: "Database connectivity failed.",
      }]
      : [],
    suspectedIncidentTypes,
    contradictions: [],
  };
}

test("baseline rules select the PostgreSQL restart with the existing fallback", () => {
  const match = findMatchingBaselineRule(
    createSnapshot("unhealthy", ["database_connectivity_failure"]),
  );

  assert.deepEqual(match?.rule.proposedActionIds, ["restart_postgres_container"]);
  assert.deepEqual(match?.rule.fallbackActionIds, ["restart_managed_system_service"]);
});

test("baseline strategy retains healthy and unmatched escalation decisions", async () => {
  const strategy = new RecoveryBaselineStrategy();
  const context = { actionAttemptCounts: {}, completedActionIds: [] };

  const healthy = await strategy.decide(createSnapshot("healthy"), context);
  const unmatched = await strategy.decide(
    createSnapshot("unknown", ["unusual_incident"]),
    context,
  );

  assert.equal(healthy.status, "no_action");
  assert.equal(unmatched.status, "escalate");
});
