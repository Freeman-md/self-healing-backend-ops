import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { config } from "../src/config/index";
import { DockerContainerRuntimeService } from "../src/infrastructure/container-runtime/docker-container-runtime.service";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import {
  ExperimentRepository,
  ExperimentService,
  createExperimentReport,
  faultProfiles,
  isFaultProfileCode,
  type FaultProfileCode,
  writeExperimentReport,
} from "../src/modules/experiment/index";
import { injectFaultProfile, restoreExperimentTargets } from "./experiment/fault-injector";
import { RecoveryOracle } from "./experiment/recovery-oracle";

type RunnerInput = {
  name: string;
  sourceRevision: string;
  recoveryMode: "baseline" | "agent";
  profiles: FaultProfileCode[];
  repetitions: number;
  runOrderSeed: string;
  stabilityWindowMs: number;
  outputDirectory: string;
};

const experimentDefaults = {
  seed: "milestone-7-pilot",
  stabilityWindowMs: 10_000,
  trialWaitTimeoutMs: 180_000,
  environmentResetTimeoutMs: 60_000,
  outputDirectory: "/managing-system/experiment-output",
} as const;

async function main(): Promise<void> {
  const input = parseArguments(process.argv.slice(2));

  validateRuntimeConfiguration(input);
  const prisma = new PrismaService();

  await prisma.open();
  const experimentService = new ExperimentService(new ExperimentRepository(prisma), {
    trialWaitTimeoutMs: experimentDefaults.trialWaitTimeoutMs,
  });

  const oracle = new RecoveryOracle(
    config.managedSystem.baseUrl,
    new DockerContainerRuntimeService(),
  );

  try {
    const configuration = await experimentService.createFrozenConfiguration({
      recoveryMode: input.recoveryMode,
      model: config.openai.model,
      monitorIntervalMs: config.monitoring.intervalMs,
      consecutiveUnhealthyThreshold: config.monitoring.consecutiveUnhealthyThreshold,
      cooldownMs: config.monitoring.cooldownMs,
      faultProfiles: input.profiles,
      stabilityWindowMs: input.stabilityWindowMs,
      preFaultSettleMs: config.monitoring.cooldownMs,
    });

    const batch = await experimentService.createExperimentBatch({
      name: input.name,
      sourceRevision: input.sourceRevision,
      configuration,
      requestedRepetitions: input.repetitions,
      runOrderSeed: input.runOrderSeed,
    });

    const runOrder = shuffledRunOrder(input.profiles, input.repetitions, input.runOrderSeed);

    for (const runInput of runOrder) {
      const run = await experimentService.prepareExperimentRun({
        batchId: batch.id,
        faultProfile: runInput.faultProfile,
        recoveryMode: input.recoveryMode,
        repetition: runInput.repetition,
        stabilityWindowMs: input.stabilityWindowMs,
      });

      console.log({
        event: "experiment_run_prepared",
        batchId: batch.id,
        runId: run.id,
        recoveryMode: run.recoveryMode,
        faultProfile: run.faultProfile,
        repetition: run.repetition,
      });
      try {
        await restoreAndVerify(oracle, experimentDefaults.environmentResetTimeoutMs);
        await sleep(config.monitoring.cooldownMs);
        const injectedRun = await experimentService.markFaultInjected(run.id);

        console.log({
          event: "experiment_fault_injection_started",
          runId: run.id,
          faultProfile: run.faultProfile,
          faultInjectedAt: injectedRun.faultInjectedAt,
        });
        await injectFaultProfile(runInput.faultProfile);
        const trial = await experimentService.waitForAndLinkMonitorTrial(injectedRun);

        console.log({
          event: "experiment_trial_linked",
          runId: run.id,
          trialRecordId: trial.id,
        });
        const oracleResult = await oracle.verifyStableRecovery(input.stabilityWindowMs);

        const completedRun = await experimentService.completeExperimentRun({
          run: injectedRun,
          trial,
          oracle: oracleResult,
        });

        console.log({
          event: "experiment_run_completed",
          runId: run.id,
          trialRecordId: trial.id,
          runtimeResolved: completedRun.runtimeResolved,
          oracleSucceeded: completedRun.oracleSucceeded,
          timeToHealMs: completedRun.timeToHealMs,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown experiment error";

        await experimentService.invalidateExperimentRun(run.id, reason).catch(() => undefined);
        console.error({
          event: "experiment_run_invalidated",
          runId: run.id,
          reason,
        });
      } finally {
        await restoreAndVerify(oracle, experimentDefaults.environmentResetTimeoutMs);
        console.log({
          event: "experiment_environment_restored",
          runId: run.id,
        });
      }
    }

    await experimentService.completeExperimentBatch(batch.id);
    const evidence = await experimentService.getExperimentEvidence(batch.id);

    const report = createExperimentReport(evidence.batch, evidence.runs);

    const outputDirectory = resolve(input.outputDirectory, batch.id);

    await writeExperimentReport({ report, outputDirectory });
    console.log({
      event: "experiment_batch_completed",
      batchId: batch.id,
      outputDirectory,
      summary: report.summary,
    });
  } finally {
    await prisma.close();
  }
}

async function restoreAndVerify(oracle: RecoveryOracle, timeoutMs: number): Promise<void> {
  await restoreExperimentTargets();
  if (!(await oracle.waitForHealthy(timeoutMs))) {
    throw new Error("The managed system did not return to a healthy reset state.");
  }
}

function parseArguments(argumentsList: string[]): RunnerInput {
  const { values } = parseArgs({
    args: argumentsList,
    allowPositionals: false,
    strict: true,
    options: {
      name: { type: "string" },
      "source-revision": { type: "string" },
      mode: { type: "string" },
      profiles: { type: "string" },
      repetitions: { type: "string" },
      "run-order-seed": { type: "string" },
      "stability-window-ms": { type: "string" },
      "output-directory": { type: "string" },
    },
  });

  const sourceRevision = requiredOption(values["source-revision"], "source-revision");

  const recoveryMode = requiredOption(values.mode, "mode");

  if (recoveryMode !== "baseline" && recoveryMode !== "agent") {
    throw new Error("--mode must be baseline or agent.");
  }

  const profiles = parseProfiles(values.profiles ?? Object.keys(faultProfiles).join(","));

  return {
    name: values.name ?? `pilot-${recoveryMode}`,
    sourceRevision,
    recoveryMode,
    profiles,
    repetitions: positiveInteger(values.repetitions ?? "2", "repetitions"),
    runOrderSeed: values["run-order-seed"] ?? experimentDefaults.seed,
    stabilityWindowMs: positiveInteger(
      values["stability-window-ms"] ?? String(experimentDefaults.stabilityWindowMs),
      "stability-window-ms",
    ),
    outputDirectory: values["output-directory"] ?? experimentDefaults.outputDirectory,
  };
}

function parseProfiles(value: string): FaultProfileCode[] {
  return value.split(",").map((candidate) => {
    const profileCode = candidate.trim();

    if (!isFaultProfileCode(profileCode)) {
      throw new Error(`Unsupported fault profile: ${profileCode}.`);
    }

    return profileCode;
  });
}

function validateRuntimeConfiguration(input: RunnerInput): void {
  if (config.trial.runMode !== "monitor") {
    throw new Error("The experiment runner requires MANAGING_SYSTEM_RUN_MODE=monitor.");
  }

  if (config.trial.recoveryMode !== input.recoveryMode) {
    throw new Error(
      `The runner mode ${input.recoveryMode} does not match the active monitor mode ${String(config.trial.recoveryMode)}.`,
    );
  }

  if (!config.actions.dockerEnabled) {
    throw new Error("Controlled fault injection requires Docker actions to be enabled.");
  }
}

function shuffledRunOrder(
  profiles: FaultProfileCode[],
  repetitions: number,
  seed: string,
): Array<{ faultProfile: FaultProfileCode; repetition: number }> {
  const runs = profiles.flatMap((faultProfile) =>
    Array.from({ length: repetitions }, (_, index) => ({
      faultProfile,
      repetition: index + 1,
    })),
  );

  const random = seededRandom(seed);

  for (let index = runs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));

    [runs[index], runs[swapIndex]] = [runs[swapIndex], runs[index]];
  }

  return runs;
}

function seededRandom(seed: string): () => number {
  let state = [...seed].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );

  return () => {
    state += 0x6d2b79f5;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function requiredOption(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`--${name} is required.`);
  }

  return value;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }

  return parsed;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error: unknown) => {
  console.error({
    event: "experiment_batch_failed",
    error: error instanceof Error ? error.message : "unknown experiment error",
  });
  process.exitCode = 1;
});
