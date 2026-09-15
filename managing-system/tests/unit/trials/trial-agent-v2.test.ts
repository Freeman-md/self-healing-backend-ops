import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionService, type Action, type ActionExecutionResult } from "@/modules/action";
import { SafetyService } from "@/modules/safety";
import { type EvidenceSnapshot } from "@/modules/evidence";
import { RecoveryAgentV2Strategy, type RecoveryDecision } from "@/modules/recovery";
import { TrialService, type TrialRecord } from "@/modules/trial";
import { EvaluationFactory } from "@/modules/evaluation";

function setup(
  options: {
    safetyEscalation?: boolean;
    providerFailure?: boolean;
    blocked?: boolean;
    persistenceFailure?: boolean;
  } = {},
) {
  const initial: EvidenceSnapshot = {
    id: "initial",
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    rawEvidenceIds: [],
    summary: "private terminal text",
    overallState: "unhealthy",
    suspectedIncidentTypes: [],
    contradictions: ["private"],
    signals: [
      {
        source: "health",
        name: "managed_system_health",
        code: "managed_system_health",
        method: "deterministic",
        status: "critical",
        value: "private environment value",
        description: "private",
      },
    ],
  };

  const fresh: EvidenceSnapshot = {
    ...initial,
    id: "fresh",
    overallState: "healthy",
    signals: initial.signals.map((signal) => ({ ...signal, status: "normal", value: true })),
  };

  const action: Action = {
    id: "restart",
    name: "Restart",
    description: "Restart service",
    handlerKey: "restart",
    riskLevel: "low",
    safetyRuleIds: ["limit"],
    expectedOutcome: { description: "healthy", successCriteria: [] },
  };

  const records: RecoveryDecision[] = [];

  const trials: TrialRecord[] = [];

  const results: ActionExecutionResult[] = [];

  const requests: string[] = [];

  let handlerCalls = 0;

  let refreshes = 0;

  let measurementCompleted = false;

  const evidence = {
    async waitForManagedSystemHealth() {},
    async collectAndNormalize() {
      refreshes += 1;

      return fresh;
    },
    async saveEvidenceSnapshot(value: EvidenceSnapshot) {
      return value;
    },
    async findEvidenceSnapshotById() {
      return fresh;
    },
  };

  const actionService = new ActionService(
    {
      async listActions() {
        return [action];
      },
      async findActionById() {
        return action;
      },
      async findSafetyRuleById() {
        return {
          id: "limit",
          checkType: options.safetyEscalation
            ? "manual_approval_required"
            : "max_attempts_not_exceeded",
          params: { maxAttempts: 1 },
          onFail: "escalate",
        };
      },
      async saveActionExecutionResult(value: ActionExecutionResult) {
        results.push(value);

        return value;
      },
    } as never,
    new SafetyService(),
    evidence as never,
    undefined,
    {
      async parseStructuredOutput() {
        return {
          expectedOutcomeMet: true,
          outcomeSummary: "private terminal text",
          continuation: "resolved",
        };
      },
    } as never,
    !options.blocked,
    {
      findActionHandler() {
        return async () => {
          handlerCalls += 1;
          assert.equal(records.length, 1);

          return { output: "private terminal text" };
        };
      },
    } as never,
  );

  const semantic = (terminal: boolean) => ({
    diagnosisResult: {
      suspectedIncidentType: "service_down",
      severity: "high",
      confidence: 0.9,
      reasoningSummary: "Health evidence",
      supportingSignals: ["managed_system_health"],
      contradictions: [],
    },
    recoveryPlan: {
      proposedActionIds: terminal ? [] : [action.id],
      fallbackActionIds: [],
      rationale: "Restore health",
      expectedOutcome: "healthy",
      escalationReason: null,
    },
    status: terminal ? "no_action" : "action_selected",
    reason: "Health evidence",
    escalationReason: null,
  });

  const respond = async (input: unknown) => {
    requests.push(JSON.stringify(input));
    if (options.providerFailure) {
      throw new Error("provider failure");
    }

    const turn = requests.length;

    return {
      conversationId: `response-${turn}`,
      calls: [
        {
          callId: `call-${turn}`,
          name:
            turn === 1
              ? "record_recovery_decision"
              : turn === 2
                ? "execute_action_1"
                : "complete_recovery",
          arguments: JSON.stringify(turn === 2 ? {} : semantic(turn > 2)),
        },
      ],
    };
  };

  const strategy = new RecoveryAgentV2Strategy({
    createToolConversation: respond,
    continueToolConversation: respond,
  });

  const runner = new TrialService(
    {
      agent: strategy,
      baseline: {
        mode: "baseline",
        orchestration: "external",
        async decide() {
          throw new Error("unused");
        },
      },
    },
    {
      async saveTrialRecord(value: TrialRecord) {
        trials.push(value);

        return value;
      },
    } as never,
    actionService,
    evidence,
    {
      createEvaluationSummary: new EvaluationFactory().createEvaluationSummary,
      async saveEvaluationSummary(value) {
        return value;
      },
    },
    {
      async recordRecoveryDecision(input) {
        if (options.persistenceFailure) {
          throw new Error("failed write");
        }

        records.push(input.recoveryDecision);

        return input.recoveryDecision;
      },
      async findRecoveryDecisionHistory() {
        return records;
      },
    },
    3,
    undefined,
    {
      async startRecoveryMeasurement() {
        return {} as never;
      },
      async recordFirstActionStarted() {
        return {} as never;
      },
      async completeRecoveryMeasurement() {
        measurementCompleted = true;

        return {} as never;
      },
    },
  );

  return {
    records,
    trials,
    results,
    requests,
    run: () => runner.runRecoveryTrial({ mode: "agent", snapshot: initial }),
    state: () => ({ handlerCalls, refreshes, measurementCompleted }),
  };
}

test("V2 controlled environment preserves history and executes via real action and safety services", async () => {
  const h = setup();

  const output = await h.run();

  assert.equal(output.trialRecord.status, "resolved");
  assert.equal(h.state().handlerCalls, 1);
  assert.equal(h.state().measurementCompleted, true);
  assert.equal(h.records.length, 2);
  assert.deepEqual(output.trialRecord.evidenceSnapshotIds, ["initial", "fresh"]);
  assert.equal(output.trialRecord.metrics.actionCount, 1);
  assert.equal(h.results[0].safetyCheckStatus, "passed");
  assert.equal(h.requests.join("").includes("private"), false);
});

test("mandatory safety escalation prevents handler access and ends the trial immediately", async () => {
  const h = setup({ safetyEscalation: true });

  assert.equal((await h.run()).trialRecord.status, "escalated");
  assert.equal(h.state().handlerCalls, 0);
  assert.equal(h.requests.length, 2);
  assert.equal(h.results[0].safetyCheckStatus, "failed");
});

test("blocked action refreshes persisted evidence for the next turn", async () => {
  const h = setup({ blocked: true });

  assert.equal((await h.run()).trialRecord.status, "resolved");
  assert.equal(h.state().handlerCalls, 0);
  assert.equal(h.state().refreshes, 1);
  assert.equal(h.requests[2].includes("fresh"), true);
});

for (const options of [{ providerFailure: true }, { persistenceFailure: true }]) {
  test(`V2 failures finalize accounting without invented decisions: ${JSON.stringify(options)}`, async () => {
    const h = setup(options);

    const output = await h.run();

    assert.equal(output.trialRecord.status, "failed");
    assert.equal(output.recoveryDecision, undefined);
    assert.equal(h.state().handlerCalls, 0);
    assert.equal(h.state().measurementCompleted, true);
    assert.equal(h.trials.length, 2);
  });
}
