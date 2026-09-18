import assert from "node:assert/strict";
import { test } from "node:test";
import { recoveryEvidenceSignature, fingerprintRecoveryConfiguration } from "@/modules/recovery";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { SafetyService } from "@/modules/safety";

function evidence(app = "exited", database = "running"): EvidenceSnapshot {
  return {
    id: "test",
    createdAt: new Date().toISOString(),
    rawEvidenceIds: [],
    targetSystem: "managed-system",
    overallState: "unhealthy",
    summary: "untrusted",
    contradictions: [],
    suspectedIncidentTypes: [],
    signals: [
      {
        code: "managed_system_reachability",
        name: "managed_system_reachability",
        method: "deterministic",
        source: "health",
        value: false,
        status: "critical",
        description: "untrusted",
      },
      {
        code: "managed_system_container_state",
        name: "managed_system_container_state",
        method: "deterministic",
        source: "container",
        value: app,
        status: app === "running" ? "normal" : "critical",
        description: "untrusted",
      },
      {
        code: "postgres_container_state",
        name: "postgres_container_state",
        method: "deterministic",
        source: "container",
        value: database,
        status: database === "running" ? "normal" : "critical",
        description: "untrusted",
      },
    ],
  };
}

test("structured matching distinguishes combined faults and ignores prose/order", () => {
  const original = evidence();

  const signature = recoveryEvidenceSignature(original, "unreachable");

  assert.ok(signature);
  assert.notEqual(
    signature,
    recoveryEvidenceSignature(evidence("exited", "exited"), "unreachable"),
  );
  assert.notEqual(signature, recoveryEvidenceSignature(original, "different"));
  assert.equal(
    signature,
    recoveryEvidenceSignature(
      { ...original, summary: "new prose", signals: [...original.signals].reverse() },
      "unreachable",
    ),
  );
  assert.equal(
    recoveryEvidenceSignature({ ...original, signals: original.signals.slice(1) }),
    null,
  );
  assert.equal(
    recoveryEvidenceSignature({ ...original, signals: [...original.signals, original.signals[0]] }),
    null,
  );
  assert.equal(
    fingerprintRecoveryConfiguration({ b: 2, a: 1 }),
    fingerprintRecoveryConfiguration({ a: 1, b: 2 }),
  );
});
test("running but unreachable is an applicability escalation independent of fault labels", () => {
  const safety = new SafetyService();

  const action = {
    id: "restart",
    name: "Restart",
    description: "Restart",
    handlerKey: "restart_managed_system_service",
    riskLevel: "low" as const,
    safetyRuleIds: [],
    expectedOutcome: { description: "Healthy", successCriteria: [] },
  };

  assert.equal(
    safety.evaluateActionSafety(action, [], { evidenceSnapshot: evidence("running", "running") })
      .status,
    "escalate",
  );
  assert.equal(
    safety.evaluateActionSafety(action, [], { evidenceSnapshot: evidence("exited", "running") })
      .status,
    "allowed",
  );
  assert.equal(
    safety.evaluateActionSafety(action, [], { evidenceSnapshot: evidence("running", "exited") })
      .status,
    "allowed",
  );
  assert.equal(
    safety.evaluateActionSafety(action, [], { evidenceSnapshot: evidence("exited", "exited") })
      .status,
    "allowed",
  );
});
