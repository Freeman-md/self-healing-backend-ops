import { config } from "@/config";
import { DockerContainerRuntimeService } from "@/infrastructure/container-runtime";
import { PrismaService } from "@/infrastructure/database";
import { OpenAIService } from "@/infrastructure/openai";
import { ActionHandlerRegistry, ActionRepository, ActionService } from "@/modules/action";
import { EvidenceRepository, EvidenceService } from "@/modules/evidence";
import { EvaluationFactory, EvaluationRepository, EvaluationService } from "@/modules/evaluation";
import { MonitoringService } from "@/modules/monitor";
import { MeasurementRepository, MeasurementService } from "@/modules/measurement";
import {
  RecoveryAgentStrategy,
  RecoveryAgentService,
  RecoveryBaselineStrategy,
  RecoveryRepository,
  RecoveryService,
} from "@/modules/recovery";
import { SafetyService } from "@/modules/safety";
import { TrialFactory, TrialRepository, TrialService } from "@/modules/trial";

async function main(): Promise<void> {
  console.log({
    event: "managing_system_started",
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
    runMode: config.trial.runMode,
  });

  const prismaService = new PrismaService();

  let closed = false;

  const closeResources = async (): Promise<void> => {
    if (closed) {
      return;
    }

    closed = true;
    await prismaService.close();
  };

  await prismaService.open();
  const containerRuntime = new DockerContainerRuntimeService();

  const measurementService = new MeasurementService(new MeasurementRepository(prismaService));

  const openaiService = new OpenAIService(undefined, measurementService);

  const evidenceService = new EvidenceService(
    new EvidenceRepository(prismaService),
    openaiService,
    undefined,
    undefined,
    containerRuntime,
  );

  const recoveryService = new RecoveryService(new RecoveryRepository(prismaService));

  const actionService = new ActionService(
    new ActionRepository(prismaService),
    new SafetyService(),
    evidenceService,
    undefined,
    openaiService,
    config.actions.dockerEnabled,
    new ActionHandlerRegistry(containerRuntime),
  );

  const trialService = new TrialService(
    {
      baseline: new RecoveryBaselineStrategy(recoveryService),
      agent: new RecoveryAgentStrategy(new RecoveryAgentService(openaiService), actionService),
    },
    new TrialRepository(prismaService),
    actionService,
    evidenceService,
    new EvaluationService(new EvaluationFactory(), new EvaluationRepository(prismaService)),
    recoveryService,
    3,
    new TrialFactory(),
    measurementService,
  );

  try {
    if (config.trial.runMode === "controlled") {
      await runControlledTrial(evidenceService, trialService);

      return;
    }

    const recoveryMode = resolveMonitorRecoveryMode();

    const monitoringService = new MonitoringService(
      evidenceService,
      trialService,
      recoveryMode,
      config.monitoring,
    );

    const stopMonitoring = (): void => monitoringService.stopMonitoring();

    process.once("SIGINT", stopMonitoring);
    process.once("SIGTERM", stopMonitoring);

    try {
      await monitoringService.startMonitoring();
    } finally {
      process.removeListener("SIGINT", stopMonitoring);
      process.removeListener("SIGTERM", stopMonitoring);
    }
  } finally {
    await closeResources();
  }
}

async function runControlledTrial(
  evidenceService: EvidenceService,
  trialService: TrialService,
): Promise<void> {
  const { recoveryMode, scenarioId } = resolveControlledTrialInput();

  const snapshot = await evidenceService.collectAndNormalize();

  const savedSnapshot = await evidenceService.saveEvidenceSnapshot(snapshot);

  console.log({
    event: "controlled_snapshot_observed",
    snapshotId: savedSnapshot.id,
    overallState: savedSnapshot.overallState,
  });
  const trialRun = await trialService.runRecoveryTrial({
    mode: recoveryMode,
    triggerSource: "controlled",
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
}

function resolveControlledTrialInput(): {
  recoveryMode: "baseline" | "agent";
  scenarioId: "S1" | "S2" | "S3";
} {
  if (!config.trial.recoveryMode || !config.trial.scenarioId) {
    throw new Error("RECOVERY_MODE and SCENARIO_ID are required for controlled mode.");
  }

  return { recoveryMode: config.trial.recoveryMode, scenarioId: config.trial.scenarioId };
}

function resolveMonitorRecoveryMode(): "baseline" | "agent" {
  if (!config.trial.recoveryMode) {
    throw new Error("RECOVERY_MODE is required for monitor mode.");
  }

  if (config.trial.scenarioId) {
    throw new Error("SCENARIO_ID is not allowed for monitor mode.");
  }

  return config.trial.recoveryMode;
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });
  process.exitCode = 1;
});
