import { AttentionRepository, AttentionService } from "@/modules/attention";
import { ExperimentRepository, ExperimentService } from "@/modules/experiment";
import {
  RecoveryHistoryRepository,
  RecoveryHistoryService,
  fingerprintRecoveryConfiguration,
  RECOVERY_POLICY_VERSION,
  RETRIEVAL_PROTOCOL_VERSION,
} from "@/modules/recovery";
import { config } from "@/config";
import { DockerContainerRuntimeService } from "@/infrastructure/container-runtime";
import { PrismaService } from "@/infrastructure/database";
import { canUseOpenAI, OpenAIService } from "@/infrastructure/openai";
import { ActionHandlerRegistry, ActionRepository, ActionService } from "@/modules/action";
import { EvidenceRepository, EvidenceService } from "@/modules/evidence";
import { EvaluationFactory, EvaluationRepository, EvaluationService } from "@/modules/evaluation";
import { MonitoringService } from "@/modules/monitor";
import {
  LocalControlledTestRunner,
  MonitoringRuntime,
  OperatorHttpServer,
  OperatorRepository,
  OperatorService,
  type OperatorStrategyId,
} from "@/modules/operator";
import { MeasurementRepository, MeasurementService } from "@/modules/measurement";
import {
  RecoveryAgentV1Strategy,
  RecoveryAgentV2Strategy,
  AGENT_V2_VERSION,
  AGENT_V2_PROMPT_VERSION,
  RecoveryAgentV1Service,
  RecoveryBaselineStrategy,
  RecoveryRepository,
  RecoveryService,
} from "@/modules/recovery";
import { SafetyService } from "@/modules/safety";
import {
  DEFAULT_MAX_RECOVERY_STEPS,
  TrialFactory,
  TrialRepository,
  TrialService,
} from "@/modules/trial";

async function main(): Promise<void> {
  console.log({
    event: "managing_system_started",
    buildRevision: config.buildRevision,
    historicalRetrievalEnabled: config.trial.historicalRetrievalEnabled,
    retrievalProtocol: RETRIEVAL_PROTOCOL_VERSION,
    sourceTrialIds: config.trial.sourceTrialIds,
    recoveryPolicyVersion: RECOVERY_POLICY_VERSION,
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
    runMode: config.trial.runMode,
    agentStrategyVersion:
      config.trial.recoveryMode === "agent" ? config.trial.agentStrategyVersion : undefined,
    agentImplementationVersion:
      config.trial.recoveryMode === "agent"
        ? config.trial.agentStrategyVersion === "v2"
          ? config.trial.historicalRetrievalEnabled
            ? "2.1.0"
            : AGENT_V2_VERSION
          : "1.0.0"
        : undefined,
    agentPromptVersion:
      config.trial.recoveryMode === "agent"
        ? config.trial.agentStrategyVersion === "v2"
          ? config.trial.historicalRetrievalEnabled
            ? "2.1.0"
            : AGENT_V2_PROMPT_VERSION
          : "1.0.0"
        : undefined,
  });

  const prismaService = new PrismaService();

  if (config.trial.runMode === "operator") {
    await runOperatorMode(prismaService);

    return;
  }

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

  const attentionService = new AttentionService(new AttentionRepository(prismaService));

  const experimentRepository = new ExperimentRepository(prismaService);

  const historyService = new RecoveryHistoryService(
    new RecoveryHistoryRepository(prismaService, recoveryService, evidenceService),
    recoveryService,
    undefined,
    {
      enabled:
        config.trial.historicalRetrievalEnabled && config.trial.agentStrategyVersion === "v2",
      sourceIds: config.trial.sourceTrialIds,
      runtimeIdentity: {
        sourceRevision: config.buildRevision,
        model: config.openai.model,
        monitorIntervalMs: config.monitoring.intervalMs,
        consecutiveUnhealthyThreshold: config.monitoring.consecutiveUnhealthyThreshold,
        cooldownMs: config.monitoring.cooldownMs,
        maxRecoverySteps: DEFAULT_MAX_RECOVERY_STEPS,
      },
      recoveryMode: config.trial.recoveryMode,
      agentStrategyVersion: config.trial.agentStrategyVersion,
      fingerprint: async () =>
        fingerprintRecoveryConfiguration({
          target: {
            identity: config.trial.targetConfigurationIdentity,
            origin: new URL(config.managedSystem.baseUrl).origin,
            requestTimeoutMs: config.managedSystem.requestTimeoutMs,
            actions: config.actions,
          },
          policy: RECOVERY_POLICY_VERSION,
          catalogue: await experimentRepository.getActiveExperimentConfigurationInputs(),
        }),
    },
  );

  const trialService = new TrialService(
    {
      baseline: new RecoveryBaselineStrategy(recoveryService),
      agent:
        config.trial.agentStrategyVersion === "v1"
          ? new RecoveryAgentV1Strategy(new RecoveryAgentV1Service(openaiService), actionService)
          : new RecoveryAgentV2Strategy(openaiService),
    },
    new TrialRepository(prismaService),
    actionService,
    evidenceService,
    new EvaluationService(new EvaluationFactory(), new EvaluationRepository(prismaService)),
    recoveryService,
    DEFAULT_MAX_RECOVERY_STEPS,
    new TrialFactory(),
    measurementService,
    historyService,
    attentionService,
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
      attentionService,
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

type OperatorBinding = {
  id: OperatorStrategyId;
  recoveryMode: "baseline" | "agent";
  agentStrategyVersion: "v1" | "v2";
  reuseEnabled: boolean;
};

async function runOperatorMode(prisma: PrismaService): Promise<void> {
  let connected = false;

  try {
    await prisma.open();
    connected = true;
  } catch (error) {
    console.error({
      event: "operator_control_plane_connection_failed",
      error: safeOperatorError(error),
    });
  }

  const containerRuntime = new DockerContainerRuntimeService();

  const measurementService = new MeasurementService(new MeasurementRepository(prisma));

  const openaiService = canUseOpenAI()
    ? new OpenAIService(undefined, measurementService)
    : undefined;

  const evidenceService = new EvidenceService(
    new EvidenceRepository(prisma),
    openaiService,
    undefined,
    undefined,
    containerRuntime,
  );

  const recoveryService = new RecoveryService(new RecoveryRepository(prisma));

  const actionService = new ActionService(
    new ActionRepository(prisma),
    new SafetyService(),
    evidenceService,
    undefined,
    openaiService,
    config.actions.dockerEnabled,
    new ActionHandlerRegistry(containerRuntime),
  );

  const attentionService = new AttentionService(new AttentionRepository(prisma));

  const experimentRepository = new ExperimentRepository(prisma);

  const createTrialService = (binding: OperatorBinding) => {
    const historyService = new RecoveryHistoryService(
      new RecoveryHistoryRepository(prisma, recoveryService, evidenceService),
      recoveryService,
      undefined,
      {
        enabled: binding.reuseEnabled,
        sourceIds: binding.reuseEnabled ? config.trial.sourceTrialIds : [],
        runtimeIdentity: {
          sourceRevision: config.buildRevision,
          model: config.openai.model,
          monitorIntervalMs: config.monitoring.intervalMs,
          consecutiveUnhealthyThreshold: config.monitoring.consecutiveUnhealthyThreshold,
          cooldownMs: config.monitoring.cooldownMs,
          maxRecoverySteps: DEFAULT_MAX_RECOVERY_STEPS,
        },
        recoveryMode: binding.recoveryMode,
        agentStrategyVersion: binding.agentStrategyVersion,
        fingerprint: async () =>
          fingerprintRecoveryConfiguration({
            target: {
              identity: config.trial.targetConfigurationIdentity,
              origin: new URL(config.managedSystem.baseUrl).origin,
              requestTimeoutMs: config.managedSystem.requestTimeoutMs,
              actions: config.actions,
            },
            policy: RECOVERY_POLICY_VERSION,
            catalogue: await experimentRepository.getActiveExperimentConfigurationInputs(),
          }),
      },
    );

    const unavailableAgent = {
      createToolConversation: async () => {
        throw new Error("OPENAI_API_KEY is required for agent recovery.");
      },
      continueToolConversation: async () => {
        throw new Error("OPENAI_API_KEY is required for agent recovery.");
      },
    };

    return new TrialService(
      {
        baseline: new RecoveryBaselineStrategy(recoveryService),
        agent:
          binding.agentStrategyVersion === "v1"
            ? new RecoveryAgentV1Strategy(
                openaiService ? new RecoveryAgentV1Service(openaiService) : undefined,
                actionService,
              )
            : new RecoveryAgentV2Strategy(openaiService ?? unavailableAgent),
      },
      new TrialRepository(prisma),
      actionService,
      evidenceService,
      new EvaluationService(new EvaluationFactory(), new EvaluationRepository(prisma)),
      recoveryService,
      DEFAULT_MAX_RECOVERY_STEPS,
      new TrialFactory(),
      measurementService,
      historyService,
      attentionService,
    );
  };

  const strategies = () => operatorStrategies();

  const runtime = new MonitoringRuntime(
    (strategy) => {
      const binding = operatorBinding(strategy);

      return new MonitoringService(
        evidenceService,
        createTrialService(binding),
        binding.recoveryMode,
        config.monitoring,
        attentionService,
      );
    },
    strategies,
    initialOperatorBinding().id,
  );

  const repository = new OperatorRepository(prisma);

  const assertReady = async () => {
    if (!/^[a-f0-9]{40}$/.test(config.buildRevision)) {
      throw new Error("A recorded clean build revision is required before controlled launch.");
    }

    if (!connected) {
      throw new Error("The persisted control plane is unavailable.");
    }

    if (!config.actions.dockerEnabled) {
      throw new Error("Docker actions are disabled.");
    }

    const [latest, active] = await Promise.all([
      repository.findLatestEvidence(),
      repository.readActiveRun(),
    ]);

    if (
      !latest ||
      latest.overallState !== "healthy" ||
      Date.now() - latest.createdAt.getTime() > config.monitoring.intervalMs * 2
    ) {
      throw new Error("A fresh deterministic healthy observation is required before launch.");
    }

    if (active) {
      throw new Error(`Controlled run ${active.id} retains the shared experiment lock.`);
    }

    const monitor = runtime.status();

    if (monitor.state === "recovering" || monitor.state === "stopped") {
      throw new Error("The monitor is not quiescent and observing.");
    }
  };

  const runner = new LocalControlledTestRunner(
    repository,
    new ExperimentService(experimentRepository),
    runtime,
    {
      sourceRevision: config.buildRevision,
      model: config.openai.model,
      targetOrigin: config.managedSystem.baseUrl,
      monitoring: config.monitoring,
      sourceTrialIds: config.trial.sourceTrialIds,
      compatibilityFingerprint: async () =>
        fingerprintRecoveryConfiguration({
          target: {
            identity: config.trial.targetConfigurationIdentity,
            origin: new URL(config.managedSystem.baseUrl).origin,
            requestTimeoutMs: config.managedSystem.requestTimeoutMs,
            actions: config.actions,
          },
          policy: RECOVERY_POLICY_VERSION,
          catalogue: await experimentRepository.getActiveExperimentConfigurationInputs(),
        }),
      ensureReady: assertReady,
    },
  );

  const service = new OperatorService(repository, attentionService, runtime, runner, {
    monitoringIntervalMs: config.monitoring.intervalMs,
    dockerActionsEnabled: config.actions.dockerEnabled,
    agentAvailable: canUseOpenAI(),
    reuseAvailable: config.trial.sourceTrialIds.length > 0,
    sourceRevision: config.buildRevision,
  });

  const server = new OperatorHttpServer(service, config.operator);

  await server.start();
  console.log({
    event: "operator_http_started",
    host: config.operator.host,
    port: config.operator.port,
    controlPlaneConnected: connected,
  });
  if (connected) {
    await runtime.start();
  }

  const shutdown = async () => {
    await server.close();
    // Keep observation and persistence alive until any accepted fault has been restored.
    await runner.waitForActiveRun();
    await runtime.stop();
  };

  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await shutdown();
  if (connected) {
    await prisma.close();
  }
}

function initialOperatorBinding(): OperatorBinding {
  if (config.trial.recoveryMode === "agent" && config.trial.agentStrategyVersion === "v1") {
    return operatorBinding("v1");
  }

  if (config.trial.recoveryMode === "agent" && config.trial.historicalRetrievalEnabled) {
    return operatorBinding("v2-reuse");
  }

  if (config.trial.recoveryMode === "agent") {
    return operatorBinding("v2");
  }

  return operatorBinding("baseline");
}

function operatorBinding(id: OperatorStrategyId): OperatorBinding {
  if (id === "baseline") {
    return { id, recoveryMode: "baseline", agentStrategyVersion: "v2", reuseEnabled: false };
  }

  if (id === "v1") {
    return { id, recoveryMode: "agent", agentStrategyVersion: "v1", reuseEnabled: false };
  }

  return { id, recoveryMode: "agent", agentStrategyVersion: "v2", reuseEnabled: id === "v2-reuse" };
}

function operatorStrategies() {
  const agentAvailable = canUseOpenAI();

  const reuseAvailable = agentAvailable && config.trial.sourceTrialIds.length > 0;

  return [
    {
      id: "baseline" as const,
      label: "Baseline",
      reuseEnabled: false,
      maxActions: 3,
      maxTurns: 3,
      ready: true,
      reason: null,
    },
    {
      id: "v1" as const,
      label: "Agent V1",
      reuseEnabled: false,
      maxActions: 3,
      maxTurns: 3,
      ready: agentAvailable,
      reason: agentAvailable ? null : "OPENAI_API_KEY is required for Agent V1.",
    },
    {
      id: "v2" as const,
      label: "Agent V2",
      reuseEnabled: false,
      maxActions: 3,
      maxTurns: 8,
      ready: agentAvailable,
      reason: agentAvailable ? null : "OPENAI_API_KEY is required for Agent V2.",
    },
    {
      id: "v2-reuse" as const,
      label: "Agent V2 with reuse",
      reuseEnabled: true,
      maxActions: 3,
      maxTurns: 12,
      ready: reuseAvailable,
      reason: reuseAvailable
        ? null
        : "OPENAI_API_KEY and frozen source-trial IDs are required for reuse-enabled V2.",
    },
  ];
}

function safeOperatorError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown error";
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });
  process.exitCode = 1;
});
