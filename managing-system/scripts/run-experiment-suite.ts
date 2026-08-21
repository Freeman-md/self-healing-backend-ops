import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import type { RecoveryMode } from "../src/generated/prisma/client";
import {
  canonicalRecoverySuite,
  experimentSuitePhases,
  type ExperimentSuitePhase,
} from "./experiment/experiment-suite.config";

type BatchSummary = {
  mode: RecoveryMode;
  batchId: string;
  relativeDirectory: string;
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  verifiedRecoveries: number;
  automaticResolutions: number;
  runtimeOracleDisagreements: number;
  safetyMaintainedRuns: number;
  medianTimeToHealMs: number | null;
  modelCallCount: number;
  modelTotalTokens: number;
};

type HealthyControlResult = {
  recoveryMode: RecoveryMode;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  healthStable: boolean;
  monitorTrialCount: number;
  actionExecutionCount: number;
  passed: boolean;
  oracleDetails: Record<string, unknown>;
};

const execFileAsync = promisify(execFile);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

const repositoryRoot = resolve(scriptDirectory, "../..");

async function main(): Promise<void> {
  const input = parseInput(process.argv.slice(2));

  const phaseConfiguration = canonicalRecoverySuite.phases[input.phase];

  const sourceRevision = input.sourceRevision ?? (await getSourceRevision());

  const campaignId = `${new Date().toISOString().replaceAll(":", "-")}-${sourceRevision}`;

  const hostCampaignDirectory = resolve(
    repositoryRoot,
    canonicalRecoverySuite.reportRoot,
    canonicalRecoverySuite.id,
    input.phase,
    campaignId,
  );

  const containerCampaignDirectory = [
    canonicalRecoverySuite.containerReportRoot,
    canonicalRecoverySuite.id,
    input.phase,
    campaignId,
  ].join("/");

  await mkdir(hostCampaignDirectory, { recursive: true });

  const initialEnvironment = environmentFor(canonicalRecoverySuite.recoveryModes[0]);

  await runCommand(
    "docker",
    ["compose", "up", "-d", "--build", "postgres", "managed-system", "managing-system-postgres"],
    initialEnvironment,
  );

  const batchSummaries: BatchSummary[] = [];

  const healthyControls: HealthyControlResult[] = [];

  for (const recoveryMode of canonicalRecoverySuite.recoveryModes) {
    const environment = environmentFor(recoveryMode);

    const containerModeDirectory = `${containerCampaignDirectory}/${recoveryMode}`;

    const hostModeDirectory = resolve(hostCampaignDirectory, recoveryMode);

    await runCommand(
      "docker",
      ["compose", "up", "-d", "--build", "--force-recreate", "managing-system"],
      environment,
    );
    await waitForMonitor(recoveryMode, canonicalRecoverySuite.monitorStartTimeoutMs, environment);
    await mkdir(hostModeDirectory, { recursive: true });

    const healthyControl = await runHealthyControl(environment);

    healthyControls.push(healthyControl);
    await writeFile(
      resolve(hostModeDirectory, "healthy-control.json"),
      JSON.stringify(healthyControl, null, 2),
    );

    if (!healthyControl.passed) {
      throw new Error(`Healthy control failed in ${recoveryMode} mode.`);
    }

    await runCommand(
      "docker",
      [
        "exec",
        "managing-system-app",
        "npm",
        "run",
        "experiment:run",
        "--",
        "--name",
        `${canonicalRecoverySuite.id}-${input.phase}-${recoveryMode}`,
        "--source-revision",
        sourceRevision,
        "--mode",
        recoveryMode,
        "--profiles",
        canonicalRecoverySuite.faultProfiles.join(","),
        "--repetitions",
        String(phaseConfiguration.repetitions),
        "--run-order-seed",
        phaseConfiguration.runOrderSeed,
        "--stability-window-ms",
        String(canonicalRecoverySuite.stabilityWindowMs),
        "--output-directory",
        containerModeDirectory,
      ],
      environment,
    );

    await runCommand(
      "docker",
      ["cp", `managing-system-app:${containerModeDirectory}/.`, hostModeDirectory],
      environment,
    );

    batchSummaries.push(await readBatchSummary(hostModeDirectory, recoveryMode));
  }

  await writeSuiteReport({
    phase: input.phase,
    sourceRevision,
    campaignId,
    campaignDirectory: hostCampaignDirectory,
    healthyControls,
    batches: batchSummaries,
  });

  console.log({
    event: "experiment_suite_completed",
    suiteId: canonicalRecoverySuite.id,
    phase: input.phase,
    sourceRevision,
    campaignDirectory: hostCampaignDirectory,
    batches: batchSummaries.map(({ mode, batchId }) => ({ mode, batchId })),
  });
}

async function runHealthyControl(environment: NodeJS.ProcessEnv): Promise<HealthyControlResult> {
  const { stdout } = await execFileAsync(
    "docker",
    [
      "exec",
      "managing-system-app",
      "npm",
      "run",
      "experiment:healthy-control",
      "--",
      "--duration-ms",
      String(canonicalRecoverySuite.healthyControlDurationMs),
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const resultLine = stdout.split("\n").find((line) => line.startsWith("HEALTHY_CONTROL_RESULT="));

  if (!resultLine) {
    throw new Error("Healthy-control command did not return a result.");
  }

  return JSON.parse(resultLine.slice("HEALTHY_CONTROL_RESULT=".length)) as HealthyControlResult;
}

function parseInput(argumentsList: string[]): {
  phase: ExperimentSuitePhase;
  sourceRevision?: string;
} {
  const { values } = parseArgs({
    args: argumentsList,
    allowPositionals: false,
    strict: true,
    options: {
      phase: { type: "string", default: "validation" },
      "source-revision": { type: "string" },
    },
  });

  if (!experimentSuitePhases.includes(values.phase as ExperimentSuitePhase)) {
    throw new Error(`--phase must be one of: ${experimentSuitePhases.join(", ")}.`);
  }

  return {
    phase: values.phase as ExperimentSuitePhase,
    sourceRevision: values["source-revision"],
  };
}

async function getSourceRevision(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repositoryRoot,
  });

  const { stdout: status } = await execFileAsync("git", ["status", "--porcelain"], {
    cwd: repositoryRoot,
  });

  const revision = stdout.trim();

  return status.trim() ? `${revision}-dirty` : revision;
}

function environmentFor(recoveryMode: RecoveryMode): NodeJS.ProcessEnv {
  return { ...process.env, RECOVERY_MODE: recoveryMode };
}

async function waitForMonitor(
  recoveryMode: RecoveryMode,
  timeoutMs: number,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { stdout, stderr } = await execFileAsync("docker", ["logs", "managing-system-app"], {
      cwd: repositoryRoot,
      env: environment,
      maxBuffer: 10 * 1024 * 1024,
    });

    const logs = `${stdout}\n${stderr}`;

    if (logs.includes("monitor_started") && logs.includes(`recoveryMode: '${recoveryMode}'`)) {
      return;
    }

    await sleep(1_000);
  }

  throw new Error(`Managing-system monitor did not start in ${recoveryMode} mode.`);
}

async function readBatchSummary(
  modeDirectory: string,
  recoveryMode: RecoveryMode,
): Promise<BatchSummary> {
  const entries = await readdir(modeDirectory, { withFileTypes: true });

  const batchDirectories = entries.filter((entry) => entry.isDirectory());

  if (batchDirectories.length !== 1) {
    throw new Error(
      `Expected one exported ${recoveryMode} batch, found ${batchDirectories.length}.`,
    );
  }

  const batchDirectory = resolve(modeDirectory, batchDirectories[0].name);

  const report = JSON.parse(await readFile(resolve(batchDirectory, "experiment.json"), "utf8")) as {
    batch: { id: string };
    summary: {
      totalRuns: number;
      validRuns: number;
      invalidRuns: number;
      verifiedRecoveries: number;
      automaticResolutions: number;
      runtimeOracleDisagreements: number;
      safetyMaintainedRuns: number;
      timing: Record<string, { median: number }>;
      model: { callCount: number; totalTokens: number };
    };
  };

  return {
    mode: recoveryMode,
    batchId: report.batch.id,
    relativeDirectory: `${recoveryMode}/${batchDirectories[0].name}`,
    totalRuns: report.summary.totalRuns,
    validRuns: report.summary.validRuns,
    invalidRuns: report.summary.invalidRuns,
    verifiedRecoveries: report.summary.verifiedRecoveries,
    automaticResolutions: report.summary.automaticResolutions,
    runtimeOracleDisagreements: report.summary.runtimeOracleDisagreements,
    safetyMaintainedRuns: report.summary.safetyMaintainedRuns,
    medianTimeToHealMs: report.summary.timing.timeToHealMs?.median ?? null,
    modelCallCount: report.summary.model.callCount,
    modelTotalTokens: report.summary.model.totalTokens,
  };
}

async function writeSuiteReport({
  phase,
  sourceRevision,
  campaignId,
  campaignDirectory,
  healthyControls,
  batches,
}: {
  phase: ExperimentSuitePhase;
  sourceRevision: string;
  campaignId: string;
  campaignDirectory: string;
  healthyControls: HealthyControlResult[];
  batches: BatchSummary[];
}): Promise<void> {
  const manifest = {
    suiteId: canonicalRecoverySuite.id,
    suiteVersion: canonicalRecoverySuite.version,
    phase,
    campaignId,
    sourceRevision,
    createdAt: new Date().toISOString(),
    configuration: canonicalRecoverySuite,
    healthyControls,
    batches,
  };

  const phaseConfiguration = canonicalRecoverySuite.phases[phase];

  const lines = [
    `# ${canonicalRecoverySuite.id} ${phase}`,
    "",
    `- Campaign ID: \`${campaignId}\``,
    `- Source revision: \`${sourceRevision}\``,
    `- Suite version: \`${canonicalRecoverySuite.version}\``,
    `- Repetitions per mode/profile cell: ${phaseConfiguration.repetitions}`,
    `- Comparative claims permitted: ${phaseConfiguration.permitsComparativeClaims ? "yes" : "no"}`,
    "",
    "## Healthy Controls",
    "",
    "| Mode | Duration (ms) | Health stable | Monitor trials | Action executions | Passed |",
    "|---|---:|---:|---:|---:|---:|",
    ...healthyControls.map(
      (control) =>
        `| ${control.recoveryMode} | ${control.durationMs} | ${control.healthStable} | ${control.monitorTrialCount} | ${control.actionExecutionCount} | ${control.passed} |`,
    ),
    "",
    "## Fault-Injection Runs",
    "",
    "| Mode | Batch ID | Runs | Valid | Invalid | Verified | Automatic | Disagreements | Safety maintained | Median time to heal (ms) | Model calls | Tokens |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...batches.map(
      (batch) =>
        `| ${batch.mode} | \`${batch.batchId}\` | ${batch.totalRuns} | ${batch.validRuns} | ${batch.invalidRuns} | ${batch.verifiedRecoveries} | ${batch.automaticResolutions} | ${batch.runtimeOracleDisagreements} | ${batch.safetyMaintainedRuns} | ${batch.medianTimeToHealMs ?? "n/a"} | ${batch.modelCallCount} | ${batch.modelTotalTokens} |`,
    ),
    "",
    phase === "validation"
      ? "This campaign validates instrumentation only and does not support comparative performance claims."
      : "This campaign is the initial descriptive benchmark defined by canonical-recovery-suite-v1.",
  ];

  await Promise.all([
    writeFile(resolve(campaignDirectory, "suite-manifest.json"), JSON.stringify(manifest, null, 2)),
    writeFile(resolve(campaignDirectory, "suite-summary.md"), lines.join("\n")),
  ]);
}

function runCommand(
  command: string,
  argumentsList: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("exit", (exitCode) => {
      if (exitCode === 0) {
        resolvePromise();

        return;
      }

      rejectPromise(new Error(`${command} exited with code ${String(exitCode)}.`));
    });
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

main().catch((error: unknown) => {
  console.error({
    event: "experiment_suite_failed",
    error: error instanceof Error ? error.message : "unknown suite error",
  });
  process.exitCode = 1;
});
