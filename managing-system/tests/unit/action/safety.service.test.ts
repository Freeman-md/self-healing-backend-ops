import assert from "node:assert/strict";
import { test } from "node:test";

import type { Action } from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { SafetyService, type SafetyRule } from "@/modules/safety";

const action: Action = {
  id: "restart_managed_system_service",
  name: "Restart managed system",
  description: "Restart the managed-system application.",
  handlerKey: "restart_managed_system_service",
  riskLevel: "medium",
  safetyRuleIds: ["allow_only_when_system_not_healthy"],
  expectedOutcome: {
    description: "The managed system returns to health.",
    successCriteria: [],
  },
};

const safetyRule: SafetyRule = {
  id: "allow_only_when_system_not_healthy",
  description: "Allow recovery only for deterministic degradation or failure.",
  checkType: "evidence_state_matches",
  params: { allowedStates: ["degraded", "unhealthy"] },
  onFail: "block",
};

function snapshot(input: {
  overallState: EvidenceSnapshot["overallState"];
  signalStatus: EvidenceSnapshot["signals"][number]["status"];
}): EvidenceSnapshot {
  return {
    id: `snapshot-${input.overallState}-${input.signalStatus}`,
    rawEvidenceIds: [],
    createdAt: "2026-08-17T10:00:00.000Z",
    targetSystem: "managed-system",
    overallState: input.overallState,
    summary: "Descriptive model output.",
    signals: [
      {
        source: "health",
        name: "managed_system_health",
        code: "managed_system_health",
        status: input.signalStatus,
        value: input.signalStatus === "normal",
        description: "Deterministic health observation.",
        method: "deterministic",
      },
    ],
    suspectedIncidentTypes: [],
    contradictions: [],
  };
}

test("safety evaluation allows deterministic failure despite descriptive healthy state", () => {
  const decision = new SafetyService().evaluateActionSafety(action, [safetyRule], {
    evidenceSnapshot: snapshot({
      overallState: "healthy",
      signalStatus: "critical",
    }),
  });

  assert.equal(decision.status, "allowed");
});

test("safety evaluation blocks deterministic health despite descriptive unhealthy state", () => {
  const decision = new SafetyService().evaluateActionSafety(action, [safetyRule], {
    evidenceSnapshot: snapshot({
      overallState: "unhealthy",
      signalStatus: "normal",
    }),
  });

  assert.equal(decision.status, "blocked");
});
