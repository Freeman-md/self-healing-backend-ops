import { config } from "@/config";
import { EvidenceNormalizer, EvidenceRepository, RawEvidenceCollector } from "@/modules/evidence";
import { ResultsRepository } from "@/modules/results";
import { TrialRunner } from "@/modules/trials";
import { canUseOpenAI } from "@/services/openai";
import { DatabaseService } from "@/shared/database/database.service";

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

    const trialRunner = new TrialRunner();
    const resultsRepository = new ResultsRepository(databaseService);
    const scenarioId = "increment-1-core-scenario";

    const baselineRun = await trialRunner.runBaselineTrial({
      scenarioId,
      snapshot: savedSnapshot,
    });
    resultsRepository.saveTrialRecord(baselineRun.trialRecord);
    resultsRepository.saveEvaluationSummary(baselineRun.evaluationSummary);

    console.log({
      event: "baseline_trial_recorded",
      decision: baselineRun.baselineDecision,
      trialRecord: baselineRun.trialRecord,
      evaluationSummary: baselineRun.evaluationSummary,
    });

    const agentRun = await trialRunner.runAgentTrial({
      scenarioId,
      snapshot: savedSnapshot,
    });
    resultsRepository.saveTrialRecord(agentRun.trialRecord);
    resultsRepository.saveEvaluationSummary(agentRun.evaluationSummary);

    console.log({
      event: "agent_trial_recorded",
      decision: agentRun.agentDecision,
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
