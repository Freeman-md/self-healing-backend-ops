import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  FunctionCall,
  ToolConversationContinuation,
  ToolConversationRequest,
} from "@/infrastructure/openai";
import type { EvidenceSnapshot } from "@/modules/evidence";
import {
  RecoveryAgentV2Strategy,
  type ControlledRecoveryEnvironment,
  type RecoveryDecision,
  type RecoveryActionObservation,
} from "@/modules/recovery";
import { readAgentStrategyVersion } from "@/config/helpers";

const snapshot = (healthy = false): EvidenceSnapshot => ({
  id: healthy ? "fresh" : "initial",
  createdAt: "2026-09-07T00:00:00.000Z",
  rawEvidenceIds: [],
  targetSystem: "managed-system",
  overallState: healthy ? "healthy" : "unhealthy",
  summary: "status",
  signals: [
    {
      source: "health",
      name: "managed_system_health",
      code: "managed_system_health",
      status: healthy ? "normal" : "critical",
      method: "deterministic",
      value: healthy,
      description: "health",
    },
  ],
  contradictions: [],
  suspectedIncidentTypes: [],
});

function decision(status = "action_selected", actions = ["restart"]): Record<string, unknown> {
  return {
    diagnosisResult: {
      suspectedIncidentType: "service_down",
      severity: "high",
      confidence: 0.8,
      reasoningSummary: "Health signal",
      supportingSignals: ["managed_system_health"],
      contradictions: [],
    },
    recoveryPlan: {
      proposedActionIds: actions,
      fallbackActionIds: [],
      rationale: "Recovery",
      expectedOutcome: "Healthy",
      escalationReason: status === "escalate" ? "Cannot recover" : null,
    },
    status,
    reason: "Evidence-based decision",
    escalationReason: status === "escalate" ? "Cannot recover" : null,
  };
}

function call(name: string, args: unknown = {}): FunctionCall[] {
  return [{ callId: "call", name, arguments: JSON.stringify(args) }];
}

function harness(
  turns: Array<FunctionCall[] | Error>,
  observations: Partial<RecoveryActionObservation>[] = [],
) {
  const requests: Array<
    ToolConversationRequest & {
      userPrompt?: string;
      conversationId?: string;
      outputs?: ToolConversationContinuation["outputs"];
      correction?: string;
    }
  > = [];

  const records: RecoveryDecision[] = [];

  const executions: string[] = [];

  const respond = (request: (typeof requests)[number]) => {
    requests.push(request);
    const next = turns[requests.length - 1] ?? [];

    if (next instanceof Error) {
      throw next;
    }

    return Promise.resolve({
      conversationId: `response-${requests.length}`,
      calls: next.map((value, index) => ({ ...value, callId: `call-${requests.length}-${index}` })),
    });
  };

  const environment: ControlledRecoveryEnvironment = {
    trialRecordId: "trusted-trial",
    maxRecoverySteps: 3,
    actions: ["restart", "repair"].map((id) => ({
      id,
      name: id,
      description: id,
      riskLevel: "low",
      expectedOutcome: { description: "healthy", successCriteria: [] },
      maxAttempts: 1,
    })),
    async recordDecision(value) {
      records.push(value);

      return value;
    },
    async executeRegisteredAction(actionId) {
      executions.push(actionId);

      return {
        actionId,
        status: "executed",
        continuation: "continue",
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        expectedOutcomeMet: false,
        outcomeSummary: "unresolved",
        evidenceSnapshot: snapshot(),
        ...observations[executions.length - 1],
      };
    },
  };

  const strategy = new RecoveryAgentV2Strategy({
    createToolConversation: respond,
    continueToolConversation: respond,
  });

  return {
    requests,
    records,
    executions,
    environment,
    run: (initial = snapshot()) => strategy.recover(initial, environment),
  };
}

test("agent version defaults to V2, selects V1, rejects invalid values and ignores baseline version", () => {
  assert.equal(readAgentStrategyVersion("agent", undefined), "v2");
  assert.equal(readAgentStrategyVersion("agent", "v1"), "v1");
  assert.equal(readAgentStrategyVersion("baseline", "invalid"), "v2");
  assert.throws(() => readAgentStrategyVersion("agent", "invalid"));
});

test("V2 persists semantic decisions, observes action feedback and replans in one conversation", async () => {
  const h = harness(
    [
      call("record_recovery_decision", decision()),
      call("execute_action_1"),
      call("record_recovery_decision", decision("action_selected", ["repair"])),
      call("execute_action_2"),
      call("complete_recovery", decision("no_action", [])),
    ],
    [
      { status: "failed", continuation: "failed" },
      { evidenceSnapshot: snapshot(true), continuation: "resolved", expectedOutcomeMet: true },
    ],
  );

  assert.equal((await h.run()).status, "resolved");
  assert.deepEqual(h.executions, ["restart", "repair"]);
  assert.equal(h.records.length, 3);
  assert.equal(new Set(h.records.map((record) => record.id)).size, 3);
  assert.equal(h.records[2].snapshotId, "fresh");
  assert.equal(h.records[0].diagnosisResult.reasoningSummary, "Health signal");
  assert.equal(h.records[0].diagnosisResult.method, "llm");
  assert.equal(h.requests[1].conversationId, "response-1");
  assert.equal(h.requests[2].conversationId, "response-2");
  assert.equal(JSON.parse(h.requests[2].outputs![0].output).status, "failed");
  assert.equal(JSON.parse(h.requests[4].outputs![0].output).evidenceSnapshot.id, "fresh");
  assert.deepEqual(
    h.requests[0].tools.map((tool) => tool.name),
    [
      "record_recovery_decision",
      "complete_recovery",
      "escalate_recovery",
      "execute_action_1",
      "execute_action_2",
    ],
  );
  for (const tool of h.requests[0].tools) {
    assert.equal(tool.parameters.additionalProperties, false);
  }
});

test("action calls require a decision and empty input; decisions are consumed after one invocation", async () => {
  const h = harness([
    call("execute_action_1"),
    call("record_recovery_decision", decision()),
    call("execute_action_1", { command: "forbidden" }),
    call("execute_action_2"),
    call("execute_action_1"),
    call("execute_action_1"),
    call("escalate_recovery", decision("escalate", [])),
  ]);

  assert.equal((await h.run()).status, "escalated");
  assert.deepEqual(h.executions, ["restart"]);
  assert.equal(h.records.length, 2);
});

for (const [label, invalid] of [
  ["metadata", { ...decision(), id: "forged", trialRecordId: "forged" }],
  [
    "nested metadata",
    {
      ...decision(),
      diagnosisResult: { ...(decision().diagnosisResult as object), evidenceSnapshotId: "forged" },
    },
  ],
  ["unknown action", decision("action_selected", ["shell"])],
  ["duplicate action", decision("action_selected", ["restart", "restart"])],
  ["empty selected plan", decision("action_selected", [])],
  [
    "unknown signal",
    {
      ...decision(),
      diagnosisResult: {
        ...(decision().diagnosisResult as object),
        supportingSignals: ["invented"],
      },
    },
  ],
] as const) {
  test(`V2 rejects ${label} without persistence or execution`, async () => {
    const h = harness([
      call("record_recovery_decision", invalid),
      call("escalate_recovery", decision("escalate", [])),
    ]);

    await h.run();
    assert.equal(h.records.length, 1);
    assert.equal(h.records[0].status, "escalate");
    assert.equal(h.executions.length, 0);
    assert.equal(JSON.parse(h.requests[1].outputs![0].output).accepted, false);
  });
}

test("premature completion is rejected and mandatory safety escalation terminates immediately", async () => {
  const h = harness(
    [
      call("complete_recovery", decision("no_action", [])),
      call("record_recovery_decision", decision()),
      call("execute_action_1"),
      call("complete_recovery", decision("no_action", [])),
    ],
    [{ status: "blocked", continuation: "escalated", safetyCheckStatus: "failed" }],
  );

  assert.equal((await h.run()).status, "escalated");
  assert.equal(h.requests.length, 3);
  assert.equal(h.records.length, 1);
});

test("blocked actions allow revised decisions while per-action attempt limits prevent another invocation", async () => {
  const h = harness(
    [
      call("record_recovery_decision", decision()),
      call("execute_action_1"),
      call("record_recovery_decision", decision()),
      call("execute_action_1"),
      call("record_recovery_decision", decision("action_selected", ["repair"])),
      call("execute_action_2"),
      call("complete_recovery", decision("no_action", [])),
    ],
    [{ status: "blocked", continuation: "blocked" }, { evidenceSnapshot: snapshot(true) }],
  );

  assert.equal((await h.run()).status, "resolved");
  assert.deepEqual(h.executions, ["restart", "repair"]);
});

test("invalid calls consume all eight turns without consuming action attempts", async () => {
  const h = harness([
    [],
    [...call("execute_action_1"), ...call("execute_action_2")],
    call("unknown"),
    [{ callId: "bad", name: "record_recovery_decision", arguments: "{" }],
  ]);

  assert.equal((await h.run()).status, "escalated");
  assert.equal(h.requests.length, 8);
  assert.equal(h.executions.length, 0);
  assert.equal(h.requests[1].correction?.includes("Exactly one"), true);
  assert.equal(h.requests[2].outputs?.length, 2);
});

test("provider failures fail and no model decision is manufactured", async () => {
  const h = harness([new Error("provider failed")]);

  assert.equal((await h.run()).status, "failed");
  assert.equal(h.records.length, 0);
});

test("global action limit prevents a fourth invocation", async () => {
  const h = harness(
    Array.from({ length: 8 }, (_, index) =>
      index % 2 === 0 ? call("record_recovery_decision", decision()) : call("execute_action_1"),
    ),
  );

  h.environment.actions[0].maxAttempts = 5;
  assert.equal((await h.run()).status, "escalated");
  assert.equal(h.executions.length, 3);
  assert.equal(h.requests.length, 8);
});
