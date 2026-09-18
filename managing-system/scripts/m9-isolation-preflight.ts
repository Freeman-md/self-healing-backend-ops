import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { PrismaService } from "../src/infrastructure/database/index";
import {
  assertUnreachable,
  ApplicationNetworkIsolation,
  type NetworkAttachment,
} from "./experiment/network-isolation";
import {
  workloadFixtureSchema,
  probeWorkloadFixture,
  validateLocalTestbed,
} from "./experiment/workload";

const command = promisify(execFile);

async function main(): Promise<void> {
  const { values } = parseArgs({
    strict: true,
    options: { fixture: { type: "string" }, output: { type: "string" } },
  });

  if (!values.fixture || !values.output) {
    throw new Error("--fixture and --output are required.");
  }

  const fixture = workloadFixtureSchema.parse(JSON.parse(await readFile(values.fixture, "utf8")));

  validateLocalTestbed(fixture.baseUrl);
  const monitor = await command(
    "docker",
    ["inspect", "--format", "{{.State.Running}}", "managing-system-app"],
    { timeout: 10000 },
  );

  if (monitor.stdout.trim() !== "false") {
    throw new Error("Stop the managing-system monitor before the isolated preflight.");
  }

  await probeWorkloadFixture(fixture);
  const prisma = new PrismaService();

  await prisma.open();
  const runId = `preflight-${randomUUID()}`;

  const batchId = `preflight-batch-${randomUUID()}`;

  const isolation = new ApplicationNetworkIsolation();

  let attachment: NetworkAttachment | undefined;

  let locked = false;

  let evidenceFileCreated = false;

  let restored = false;

  const evidence: Record<string, unknown> = {
    runId,
    startedAt: new Date().toISOString(),
    restartDidNotRepair: false,
    restorationVerified: false,
  };

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.experimentBatch.create({
        data: {
          id: batchId,
          name: "m9-isolation-preflight",
          status: "active",
          sourceRevision: "preflight-only",
          measurementVersion: "2.0.0",
          configuration: { purpose: "external-preflight" },
          requestedRepetitions: 1,
          runOrderSeed: "none",
          createdAt: new Date(),
        },
      });
      await transaction.experimentRun.create({
        data: {
          id: runId,
          batchId,
          faultProfile: "managed_system_application_network_isolated",
          recoveryMode: "agent",
          repetition: 1,
          status: "prepared",
          activeLockKey: "global",
          startedAt: new Date(),
          stabilityWindowMs: 0,
        },
      });
    });
    locked = true;
    attachment = await isolation.captureAttachment();
    evidence.attachment = attachment;
    await writeFile(values.output, JSON.stringify(evidence, null, 2), { flag: "wx" });
    evidenceFileCreated = true;
    await prisma.experimentRunManifest.create({
      data: {
        runId,
        configuration: { purpose: "external-preflight" },
        restoration: { status: "captured", attachment },
      },
    });
    await isolation.disconnectApplication(attachment);
    await assertUnreachable(fixture.baseUrl);
    await command("docker", ["restart", "managed-system-app"], { timeout: 10000 });
    await isolation.verifyIsolated();
    await assertUnreachable(fixture.baseUrl);
    evidence.restartDidNotRepair = true;
  } finally {
    try {
      if (attachment) {
        await isolation.restoreAttachment(attachment);
        const deadline = Date.now() + 60000;

        while (true) {
          try {
            await probeWorkloadFixture(fixture);
            const health = await fetch(new URL("/health", fixture.baseUrl), {
              signal: AbortSignal.timeout(5000),
            });

            const body = (await health.json()) as { status?: string };

            if (!health.ok || body.status !== "healthy") {
              throw new Error("Restored application is not healthy.");
            }

            break;
          } catch (error) {
            if (Date.now() >= deadline) {
              throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      restored = true;
      evidence.restorationVerified = !!attachment;
    } catch (error) {
      evidence.restorationError = error instanceof Error ? error.message : "Restoration failed";
      throw error;
    } finally {
      evidence.completedAt = new Date().toISOString();
      try {
        if (locked) {
          await prisma.experimentRun.update({
            where: { id: runId },
            data: {
              status: "invalid",
              valid: false,
              exclusionReason: "Isolated preflight, not a recovery observation",
              activeLockKey: restored ? null : "global",
              completedAt: new Date(),
            },
          });
          await prisma.experimentBatch.update({
            where: { id: batchId },
            data: { status: restored ? "completed" : "failed", completedAt: new Date() },
          });
          if (evidenceFileCreated) {
            await writeFile(values.output, JSON.stringify(evidence, null, 2));
          }
        }
      } finally {
        await prisma.close();
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Isolation preflight failed");
  process.exitCode = 1;
});
