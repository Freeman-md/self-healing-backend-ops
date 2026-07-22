import { config } from "@/config";
import { DatabaseService } from "@/infrastructure/database";
import { canUseOpenAI } from "@/infrastructure/openai";
import {
  ActionExecutionRepository,
  ActionExecutor,
  ActionOutcomeEvaluator,
  ActionRegistry,
} from "@/modules/actions";
import {
  EvidenceCollector,
  EvidenceNormalizer,
  EvidenceRepository,
} from "@/modules/evidence";
import { EvaluationRepository } from "@/modules/evaluation";
import {
  AgentRecoveryStrategy,
  BaselineRecoveryStrategy,
} from "@/modules/recovery";
import { SafetyGate } from "@/modules/safety";
import { TrialRepository, TrialRunner } from "@/modules/trials";

async function main() {
  console.log({
    event: "managing_system_started",
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
  });

  const collector = new EvidenceCollector();
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

  const databaseService = new DatabaseService();

  try {
    const normalizer = new EvidenceNormalizer();
    const snapshot = await normalizer.normalize(evidence);
    const evidenceRepository = new EvidenceRepository(databaseService);
    const savedSnapshot = evidenceRepository.saveSnapshot(snapshot);

    console.log({
      event: "evidence_snapshot_created",
      snapshot: savedSnapshot,
    });

    console.log({
      event: "evidence_snapshot_persisted",
      snapshotId: savedSnapshot.id,
      path: config.database.path,
    });

    const trialRepository = new TrialRepository(databaseService);
    const evaluationRepository = new EvaluationRepository(databaseService);
    const actionExecutionRepository = new ActionExecutionRepository(databaseService);
    const actionRegistry = new ActionRegistry();
    const safetyGate = new SafetyGate(actionRegistry);
    const actionExecutor = new ActionExecutor(
      actionRegistry,
      safetyGate,
      collector,
      normalizer,
      evidenceRepository,
      new ActionOutcomeEvaluator(),
    );
    const trialRunner = new TrialRunner(
      {
        baseline: new BaselineRecoveryStrategy(),
        agent: new AgentRecoveryStrategy(),
      },
      actionRegistry,
      actionExecutor,
      evidenceRepository,
      actionExecutionRepository,
    );
    const scenarioId = "increment-1-core-scenario";

    const baselineRun = await trialRunner.runRecoveryTrial({
      mode: "baseline",
      scenarioId,
      snapshot: savedSnapshot,
    });
    trialRepository.save(baselineRun.trialRecord);
    evaluationRepository.save(baselineRun.evaluationSummary);

    console.log({
      event: "baseline_trial_recorded",
      decision: baselineRun.recoveryDecision,
      trialRecord: baselineRun.trialRecord,
      evaluationSummary: baselineRun.evaluationSummary,
    });

    const agentRun = await trialRunner.runRecoveryTrial({
      mode: "agent",
      scenarioId,
      snapshot: savedSnapshot,
    });
    trialRepository.save(agentRun.trialRecord);
    evaluationRepository.save(agentRun.evaluationSummary);

    console.log({
      event: "agent_trial_recorded",
      decision: agentRun.recoveryDecision,
      trialRecord: agentRun.trialRecord,
      evaluationSummary: agentRun.evaluationSummary,
    });
  } finally {
    databaseService.close();
  }
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });

  process.exitCode = 1;
});
