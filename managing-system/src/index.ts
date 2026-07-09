import { config } from "@/config";
import { ActionRegistry } from "@/modules/actions";
import { EvidenceNormalizer, EvidenceStore, RawEvidenceCollector } from "@/modules/evidence";
import { BaselineRecoveryEngine } from "@/modules/recovery";
import { SafetyGate } from "@/modules/safety";
import { canUseOpenAI } from "@/services/openai";

async function main() {
  console.log({
    event: "managing_system_started",
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
  });

  const collector = new RawEvidenceCollector();
  const evidence = await collector.collect();

  console.log({
    event: "raw_evidence_collected",
    evidence: evidence.map((item) => ({
      id: item.id,
      source: item.source,
      target: item.target,
      status: item.status,
      error: item.error,
    })),
  });

  if (!canUseOpenAI()) {
    console.log({
      event: "evidence_normalization_skipped",
      reason: "OPENAI_API_KEY is not configured",
    });

    return;
  }

  const normalizer = new EvidenceNormalizer();
  const snapshot = await normalizer.normalize(evidence);
  const evidenceStore = new EvidenceStore();
  const savedSnapshot = evidenceStore.saveSnapshot(snapshot);
  evidenceStore.close();

  console.log({
    event: "evidence_snapshot_created",
    snapshot: savedSnapshot,
  });

  console.log({
    event: "evidence_snapshot_persisted",
    snapshotId: savedSnapshot.id,
    databasePath: config.evidenceStore.databasePath,
  });

  const baselineRecoveryEngine = new BaselineRecoveryEngine();
  const baselineDecision = baselineRecoveryEngine.decide(savedSnapshot);

  console.log({
    event: "baseline_recovery_decided",
    decision: baselineDecision,
  });

  if (baselineDecision.status !== "action_selected" || !baselineDecision.selectedActionId) {
    return;
  }

  const actionRegistry = new ActionRegistry();
  const selectedAction = actionRegistry.findActionById(baselineDecision.selectedActionId);

  if (!selectedAction) {
    console.log({
      event: "action_registry_miss",
      actionId: baselineDecision.selectedActionId,
    });

    return;
  }

  console.log({
    event: "action_registry_resolved",
    actionId: selectedAction.id,
    handlerKey: selectedAction.handlerKey,
    safetyRuleIds: selectedAction.safetyRuleIds,
  });

  const safetyGate = new SafetyGate(actionRegistry);
  const safetyDecision = safetyGate.evaluate(selectedAction, {
    evidenceSnapshot: savedSnapshot,
    actionAttemptCounts: {
      [selectedAction.id]: 0,
    },
    completedActionIds: [],
    manualApprovalGranted: false,
  });

  console.log({
    event: "safety_gate_decided",
    decision: safetyDecision,
  });
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });

  process.exitCode = 1;
});
