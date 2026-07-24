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
  RecoveryRepository,
  RecoveryService,
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
  const containerRuntime = new DockerContainerRuntimeService();
  const evidenceService = new EvidenceService(
    evidenceRepository,
    undefined,
    undefined,
    undefined,
    containerRuntime,
  );

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
    const recoveryRepository = new RecoveryRepository(databaseService);
    const recoveryService = new RecoveryService(recoveryRepository);
    const evaluationRepository = new EvaluationRepository(databaseService);
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
      recoveryService,
    );
    const { recoveryMode, scenarioId } = resolveControlledTrialInput();
    const trialRun = await trialService.runRecoveryTrial({
      mode: recoveryMode,
      scenarioId,
      snapshot: savedSnapshot,
    });
    console.log({
      event: "controlled_trial_recorded",
      recoveryMode,
      scenarioId,
      decision: trialRun.recoveryDecision,
      recoveryDecisions: trialRun.recoveryDecisions,
      trialRecord: trialRun.trialRecord,
      evaluationSummary: trialRun.evaluationSummary,
    });
  } finally {
    databaseService.close();
  }
}

function resolveControlledTrialInput(): {
  recoveryMode: "baseline" | "agent";
  scenarioId: "S1" | "S2" | "S3";
} {
  if (!config.trial.recoveryMode || !config.trial.scenarioId) {
    throw new Error("RECOVERY_MODE and SCENARIO_ID are required for controlled trials.");
  }
  return { recoveryMode: config.trial.recoveryMode, scenarioId: config.trial.scenarioId };
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });

  process.exitCode = 1;
});
