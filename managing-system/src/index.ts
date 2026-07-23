import { config } from "@/config";
import { DatabaseService } from "@/infrastructure/database";
import { canUseOpenAI } from "@/infrastructure/openai";
import { ActionRepository, ActionService } from "@/modules/action";
import { EvidenceService, EvidenceRepository } from "@/modules/evidence";
import { EvaluationRepository } from "@/modules/evaluation";
import {
  RecoveryAgentStrategy,
  RecoveryBaselineStrategy,
} from "@/modules/recovery";
import { TrialRepository, TrialService } from "@/modules/trial";

async function main() {
  console.log({
    event: "managing_system_started",
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
  });

  const evidenceService = new EvidenceService();
  const evidence = await evidenceService.collectRawEvidence();

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
    const snapshot = await evidenceService.normalizeEvidence(evidence);
    const evidenceRepository = new EvidenceRepository(databaseService);
    const savedSnapshot = evidenceRepository.saveEvidenceSnapshot(snapshot);

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
    const actionRepository = new ActionRepository(databaseService);
    const actionService = new ActionService(actionRepository, undefined, evidenceService, evidenceRepository);
    const trialRunner = new TrialService(
      {
        baseline: new RecoveryBaselineStrategy(),
        agent: new RecoveryAgentStrategy(),
      },
      actionRepository,
      actionService,
      evidenceRepository,
    );
    const scenarioId = "increment-1-core-scenario";

    const baselineRun = await trialRunner.runRecoveryTrial({
      mode: "baseline",
      scenarioId,
      snapshot: savedSnapshot,
    });
    trialRepository.saveTrialRecord(baselineRun.trialRecord);
    evaluationRepository.saveEvaluationSummary(baselineRun.evaluationSummary);

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
    trialRepository.saveTrialRecord(agentRun.trialRecord);
    evaluationRepository.saveEvaluationSummary(agentRun.evaluationSummary);

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
