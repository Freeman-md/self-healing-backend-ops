import { parseArgs } from "node:util";

import { config } from "../../src/config/index";
import { DockerContainerRuntimeService } from "../../src/infrastructure/container-runtime/docker-container-runtime.service";
import { PrismaService } from "../../src/infrastructure/database/prisma.service";
import { RecoveryOracle } from "./recovery-oracle";

async function main(): Promise<void> {
  const durationMs = parseDuration(process.argv.slice(2));

  const startedAt = new Date();

  const prisma = new PrismaService();

  const oracle = new RecoveryOracle(
    config.managedSystem.baseUrl,
    new DockerContainerRuntimeService(),
  );

  await prisma.open();

  try {
    const oracleResult = await oracle.verifyStableRecovery(durationMs);

    const [monitorTrialCount, actionExecutionCount] = await Promise.all([
      prisma.trialRecord.count({
        where: {
          triggerSource: "monitor",
          startedAt: { gte: startedAt },
        },
      }),
      prisma.actionExecutionResult.count({
        where: {
          trial: {
            triggerSource: "monitor",
            startedAt: { gte: startedAt },
          },
        },
      }),
    ]);

    const result = {
      recoveryMode: config.trial.recoveryMode,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      healthStable: oracleResult.succeeded,
      monitorTrialCount,
      actionExecutionCount,
      passed: oracleResult.succeeded && monitorTrialCount === 0 && actionExecutionCount === 0,
      oracleDetails: oracleResult.details,
    };

    console.log(`HEALTHY_CONTROL_RESULT=${JSON.stringify(result)}`);

    if (!result.passed) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.close();
  }
}

function parseDuration(argumentsList: string[]): number {
  const { values } = parseArgs({
    args: argumentsList,
    allowPositionals: false,
    strict: true,
    options: {
      "duration-ms": { type: "string" },
    },
  });

  const durationMs = Number(values["duration-ms"]);

  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new Error("--duration-ms must be a positive integer.");
  }

  return durationMs;
}

main().catch((error: unknown) => {
  console.error({
    event: "healthy_control_failed",
    error: error instanceof Error ? error.message : "unknown healthy-control error",
  });
  process.exitCode = 1;
});
