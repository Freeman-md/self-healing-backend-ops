import { config } from "@/config";
import { DatabaseService } from "@/infrastructure/database";
import { DockerContainerRuntimeService } from "@/infrastructure/container-runtime";
import { canUseOpenAI } from "@/infrastructure/openai";
import { ActionRepository, ActionService } from "@/modules/action";
import { EvidenceService, EvidenceRepository } from "@/modules/evidence";
import {
  EvaluationFactory,
  EvaluationRepository,
  EvaluationService,
} from "@/modules/evaluation";
import {
  RecoveryAgentStrategy,
  RecoveryBaselineStrategy,
} from "@/modules/recovery";
import { TrialRepository, TrialService } from "@/modules/trial";
import { SafetyService } from "@/modules/safety";

async function main() {
  console.log({
    event: "managing_system_started",
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
  });

  const databaseService = new DatabaseService();
  const evidenceRepository = new EvidenceRepository(databaseService);
  const evidenceService = new EvidenceService(evidenceRepository);

  try {
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

    const snapshot = await evidenceService.normalizeEvidence(evidence);
    const savedSnapshot = evidenceService.saveEvidenceSnapshot(snapshot);

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
    const containerRuntime = new DockerContainerRuntimeService();
    const actionRepository = new ActionRepository(databaseService, containerRuntime);
    const safetyService = new SafetyService();
    const actionService = new ActionService(
      actionRepository,
      safetyService,
      evidenceService,
      undefined,
      undefined,
      config.actions.dockerEnabled,
    );
    const evaluationService = new EvaluationService(
      new EvaluationFactory(),
      evaluationRepository,
    );
    const trialService = new TrialService(
      {
        baseline: new RecoveryBaselineStrategy(),
        agent: new RecoveryAgentStrategy(undefined, actionService),
      },
      trialRepository,
      actionService,
      evidenceService,
      evaluationService,
    );
    const scenarioId = "increment-1-core-scenario";

    const baselineRun = await trialService.runRecoveryTrial({
      mode: "baseline",
      scenarioId,
      snapshot: savedSnapshot,
    });
    console.log({
      event: "baseline_trial_recorded",
      decision: baselineRun.recoveryDecision,
      trialRecord: baselineRun.trialRecord,
      evaluationSummary: baselineRun.evaluationSummary,
    });

    const agentRun = await trialService.runRecoveryTrial({
      mode: "agent",
      scenarioId,
      snapshot: savedSnapshot,
    });
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
