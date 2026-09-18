import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod/v4";
import { config } from "../src/config/index";
import { PrismaService } from "../src/infrastructure/database/index";
import { DockerContainerRuntimeService } from "../src/infrastructure/container-runtime/index";
import { EvidenceRepository } from "../src/modules/evidence/index";
import {
  ExperimentRepository,
  ExperimentService,
  createExperimentReport,
  writeExperimentReport,
} from "../src/modules/experiment/index";
import {
  RecoveryHistoryRepository,
  RecoveryRepository,
  RecoveryService,
  fingerprintRecoveryConfiguration,
  RECOVERY_POLICY_VERSION,
} from "../src/modules/recovery/index";
import { m9ConditionSchema, m9ProtocolSchema, prepareM9Protocol } from "./experiment/m9-protocol";
import {
  assertUnreachable,
  ApplicationNetworkIsolation,
  type NetworkAttachment,
} from "./experiment/network-isolation";
import { RecoveryOracle } from "./experiment/recovery-oracle";
import { injectFaultProfile, restoreExperimentTargets } from "./experiment/fault-injector";
import {
  workloadFixtureSchema,
  workloadSettingsSchema,
  probeWorkloadFixture,
  startBoundedWorkload,
  summarizeWorkload,
  waitForFixedObservationWindow,
  validateLocalTestbed,
} from "./experiment/workload";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { values } = parseArgs({
    strict: true,
    options: {
      prepare: { type: "boolean" },
      smoke: { type: "boolean" },
      manifest: { type: "string" },
      condition: { type: "string" },
      revision: { type: "string" },
      fixture: { type: "string" },
      settings: { type: "string" },
      calibration: { type: "string" },
      preflight: { type: "string" },
      output: { type: "string" },
    },
  });

  if (!values.manifest) {
    throw new Error("--manifest is required.");
  }

  if (values.prepare) {
    const protocol = prepareM9Protocol({
      sourceRevision: values.revision!,
      smoke: values.smoke ?? false,
      condition: m9ConditionSchema.parse(values.condition),
      seed: "m9-fixed-2026-09-18",
      fixturePath: values.fixture!,
      calibrationPath: values.calibration ?? null,
      isolationPreflightPath: values.preflight ?? null,
      workload: values.settings
        ? workloadSettingsSchema.parse(JSON.parse(await readFile(values.settings, "utf8")))
        : null,
      preFaultSettleMs: config.monitoring.cooldownMs + config.monitoring.intervalMs * 2,
      suppressionWindowMs:
        config.monitoring.cooldownMs +
        config.monitoring.intervalMs * (config.monitoring.consecutiveUnhealthyThreshold + 2),
    });

    await mkdir(dirname(values.manifest), { recursive: true });
    await writeFile(values.manifest, JSON.stringify(protocol, null, 2), { flag: "wx" });

    return;
  }

  if (!values.output) {
    throw new Error("--output is required; every execution uses a new directory.");
  }

  const protocol = m9ProtocolSchema.parse(JSON.parse(await readFile(values.manifest, "utf8")));

  if (config.buildRevision !== protocol.sourceRevision) {
    throw new Error(
      "Runner build identity differs from the prepared revision; rebuild from the approved checkout with SOURCE_REVISION.",
    );
  }

  const fixture = workloadFixtureSchema.parse(
    JSON.parse(await readFile(protocol.fixturePath, "utf8")),
  );

  validateLocalTestbed(config.managedSystem.baseUrl);
  if (fixture.baseUrl !== config.managedSystem.baseUrl) {
    throw new Error("Fixture and configured target differ.");
  }

  if (config.trial.runMode !== "monitor" || !config.actions.dockerEnabled) {
    throw new Error("A configured monitor and local Docker effects are required.");
  }

  const mode = protocol.condition === "baseline" ? "baseline" : "agent";

  const version = protocol.condition === "v1" ? "v1" : "v2";

  if (
    config.trial.recoveryMode !== mode ||
    (mode === "agent" && config.trial.agentStrategyVersion !== version)
  ) {
    throw new Error("Runner configuration does not match prepared condition.");
  }

  if (protocol.condition === "non-idle") {
    if (!protocol.workload || !protocol.calibrationPath) {
      throw new Error("Non-idle condition requires frozen calibration.");
    }

    if (
      protocol.workload.maximumDurationMs <
      protocol.workload.warmupMs + protocol.workload.postRecoveryMs + 210000
    ) {
      throw new Error(
        "Workload bound must cover the full warmup, trial/oracle and post-recovery windows.",
      );
    }

    const calibration = z
      .object({
        passed: z.literal(true),
        fixture: workloadFixtureSchema,
        settings: workloadSettingsSchema,
      })
      .parse(JSON.parse(await readFile(protocol.calibrationPath, "utf8")));

    if (
      JSON.stringify(calibration.fixture) !== JSON.stringify(fixture) ||
      JSON.stringify(calibration.settings) !== JSON.stringify(protocol.workload)
    ) {
      throw new Error("Calibration differs from frozen fixture/load.");
    }
  }

  const output = resolve(values.output);

  await mkdir(output, { recursive: false });
  const prisma = new PrismaService();

  await prisma.open();
  const repository = new ExperimentRepository(prisma);

  const experiments = new ExperimentService(repository);

  const history = new RecoveryHistoryRepository(
    prisma,
    new RecoveryService(new RecoveryRepository(prisma)),
    new EvidenceRepository(prisma),
  );

  const oracle = new RecoveryOracle(
    config.managedSystem.baseUrl,
    new DockerContainerRuntimeService(),
  );

  const isolation = new ApplicationNetworkIsolation();

  let batchId: string | undefined;

  let coldSource: string | undefined;

  try {
    const retrievalEnabled = ["v2-empty", "reuse", "unsupported"].includes(protocol.condition);

    const catalogue = await repository.getActiveExperimentConfigurationInputs();

    const compatibilityFingerprint = fingerprintRecoveryConfiguration({
      target: {
        identity: config.trial.targetConfigurationIdentity,
        origin: new URL(config.managedSystem.baseUrl).origin,
        requestTimeoutMs: config.managedSystem.requestTimeoutMs,
        actions: config.actions,
      },
      policy: RECOVERY_POLICY_VERSION,
      catalogue,
    });

    const configuration = await experiments.createFrozenConfiguration({
      recoveryMode: mode,
      agentStrategyVersion: mode === "agent" ? version : undefined,
      agentImplementationVersion:
        mode === "baseline"
          ? "1.0.0"
          : version === "v1"
            ? "1.0.0"
            : retrievalEnabled
              ? "2.1.0"
              : "2.0.0",
      agentPromptVersion:
        mode === "baseline" || version === "v1" ? "1.0.0" : retrievalEnabled ? "2.1.0" : "2.0.0",
      model: config.openai.model,
      promptVersion: "1.0.0",
      maxRecoverySteps: 3,
      monitorIntervalMs: config.monitoring.intervalMs,
      consecutiveUnhealthyThreshold: config.monitoring.consecutiveUnhealthyThreshold,
      cooldownMs: config.monitoring.cooldownMs,
      faultProfiles: [...new Set(protocol.runOrder.map((entry) => entry.profile))],
      stabilityWindowMs: protocol.stabilityWindowMs,
      preFaultSettleMs: protocol.preFaultSettleMs,
    });

    const batch = await experiments.createExperimentBatch({
      name: `m9-${protocol.condition}`,
      sourceRevision: protocol.sourceRevision,
      configuration,
      requestedRepetitions: protocol.repetitions,
      runOrderSeed: protocol.seed,
    });

    batchId = batch.id;
    const frozen = {
      protocol,
      configuration,
      compatibilityFingerprint,
      fixture,
      maxAgentTurns: mode === "agent" && version === "v2" ? (retrievalEnabled ? 12 : 8) : null,
      providerSettings: {
        model: config.openai.model,
        toolChoice: mode === "agent" && version === "v2" ? "required" : null,
        parallelToolCalls: mode === "agent" && version === "v2" ? false : null,
      },
    };

    await prisma.experimentBatch.update({
      where: { id: batch.id },
      data: { measurementVersion: "2.0.0", configuration: JSON.parse(JSON.stringify(frozen)) },
    });
    await writeFile(resolve(output, "manifest.json"), JSON.stringify(frozen, null, 2));
    for (const slot of protocol.runOrder) {
      if (slot.phase === "cold") {
        coldSource = undefined;
      }

      const run = await experiments.prepareExperimentRun({
        batchId: batch.id,
        faultProfile: slot.profile,
        recoveryMode: mode,
        repetition: slot.repetition,
        stabilityWindowMs: protocol.stabilityWindowMs,
      });

      const sourceTrialIds = slot.phase === "warm" && coldSource ? [coldSource] : [];

      await prisma.experimentRunManifest.create({
        data: {
          runId: run.id,
          configuration: {
            ...JSON.parse(JSON.stringify(frozen)),
            retrievalEnabled,
            sourceTrialIds,
            expectedRecoveryMode: mode,
            expectedAgentStrategyVersion: version,
            compatibilityFingerprint,
          },
        },
      });
      let attachment: NetworkAttachment | undefined;

      let traffic: ReturnType<typeof startBoundedWorkload> | undefined;

      let restorationVerified = false;

      let failed = false;

      let faultAt: number | null = null;

      let trialCompletedAt: number | null = null;

      let postWindow: { start: number; end: number } | undefined;

      let postWindowKind: "post_recovery" | "post_termination" | undefined;

      try {
        if (slot.phase === "warm" && !coldSource) {
          throw new Error("Warm run excluded: paired cold source was not independently verified.");
        }

        await restoreExperimentTargets();
        if (!(await oracle.waitForHealthy(60000))) {
          throw new Error("Reset health verification failed.");
        }

        await probeWorkloadFixture(fixture);
        await sleep(protocol.preFaultSettleMs);
        if (protocol.condition === "non-idle" && protocol.workload) {
          traffic = startBoundedWorkload({ fixture, settings: protocol.workload });
        }

        await sleep(protocol.workload?.warmupMs ?? 1000);
        if (slot.profile === "managed_system_application_network_isolated") {
          if (!protocol.isolationPreflightPath) {
            throw new Error(
              "Unsupported panel requires successful isolated restart-invariance preflight evidence.",
            );
          }

          const preflight = z
            .object({
              restartDidNotRepair: z.literal(true),
              restorationVerified: z.literal(true),
              attachment: z.unknown(),
            })
            .parse(JSON.parse(await readFile(protocol.isolationPreflightPath, "utf8")));

          attachment = await isolation.captureAttachment();
          if (JSON.stringify(preflight.attachment) !== JSON.stringify(attachment)) {
            throw new Error(
              "Testbed attachment changed since preflight; repeat preflight before preparing a new panel.",
            );
          }
        }

        // Persist restoration information before the reversible external mutation.
        await prisma.experimentRunManifest.update({
          where: { runId: run.id },
          data: { restoration: { status: "captured", attachment: attachment ?? null } },
        });
        const injected = await experiments.markFaultInjected(run.id);

        faultAt = injected.faultInjectedAt!.getTime();
        if (attachment) {
          await isolation.disconnectApplication(attachment);
          await assertUnreachable(fixture.baseUrl);
        } else {
          await injectFaultProfile(slot.profile);
        }

        const trial = await experiments.waitForAndLinkMonitorTrial(injected);

        const episode = await prisma.recoveryEpisode.findUnique({
          where: { trialRecordId: trial.id },
        });

        if (!episode || episode.experimentRunId !== run.id) {
          throw new Error(
            "Monitor did not establish the validated frozen runtime identity; observation is invalid.",
          );
        }

        trialCompletedAt = new Date(trial.completedAt).getTime();
        let observed = await oracle.verifyStableRecovery(protocol.stabilityWindowMs);

        if (attachment) {
          await isolation.verifyIsolated();
          const attention = await prisma.recoveryAttention.findUnique({
            where: { trialRecordId: trial.id },
          });

          const unsuitableEffects = await prisma.actionExecutionResult.count({
            where: { trialRecordId: trial.id, status: { in: ["executed", "failed"] } },
          });

          await sleep(protocol.suppressionWindowMs);
          const retrials = await prisma.trialRecord.count({
            where: {
              triggerSource: "monitor",
              startedAt: { gte: injected.faultInjectedAt! },
              id: { not: trial.id },
            },
          });

          const passed =
            trial.status === "escalated" &&
            attention !== null &&
            unsuitableEffects === 0 &&
            retrials === 0;

          observed = {
            succeeded: passed,
            firstHealthyObservedAt: null,
            checkedAt: new Date().toISOString(),
            details: {
              oracleKind: "escalation",
              attentionRecorded: !!attention,
              unsuitableEffects,
              retrials,
              passed,
            },
          };
        } else {
          try {
            await probeWorkloadFixture(fixture);
          } catch {
            observed = {
              ...observed,
              succeeded: false,
              details: { ...observed.details, businessProbeFailed: true },
            };
          }
        }

        postWindowKind =
          !attachment && observed.succeeded && trial.status === "resolved"
            ? "post_recovery"
            : "post_termination";
        postWindow = await waitForFixedObservationWindow(protocol.workload?.postRecoveryMs ?? 1000);
        await experiments.completeExperimentRun({ run: injected, trial, oracle: observed });
        if (!attachment && observed.succeeded) {
          await history.publishEligibleTrial(trial.id);
          if (
            slot.phase === "cold" &&
            (await prisma.recoveryCase.count({ where: { sourceTrialId: trial.id } })) > 0
          ) {
            coldSource = trial.id;
          }
        }
      } catch (error) {
        failed = true;
        await experiments.invalidateExperimentRun(
          run.id,
          error instanceof Error ? error.message : "Controlled run failed.",
        );
      } finally {
        let workloadPersistenceError: unknown;

        try {
          if (traffic) {
            const end = Date.now();

            const samples = await traffic.stop();

            await prisma.experimentRunManifest.update({
              where: { runId: run.id },
              data: {
                workload: {
                  samples,
                  summary: summarizeWorkload(samples, traffic.startedAt, end),
                  warmup: faultAt ? summarizeWorkload(samples, traffic.startedAt, faultAt) : null,
                  recovery:
                    faultAt && trialCompletedAt
                      ? summarizeWorkload(samples, faultAt, trialCompletedAt)
                      : null,
                  verification:
                    trialCompletedAt && postWindow
                      ? summarizeWorkload(samples, trialCompletedAt, postWindow.start)
                      : null,
                  postWindow: postWindow ?? null,
                  postWindowKind: postWindowKind ?? null,
                  postRecovery:
                    postWindow && postWindowKind === "post_recovery"
                      ? summarizeWorkload(samples, postWindow.start, postWindow.end)
                      : null,
                  postTermination:
                    postWindow && postWindowKind === "post_termination"
                      ? summarizeWorkload(samples, postWindow.start, postWindow.end)
                      : null,
                },
              },
            });
          }
        } catch (error) {
          workloadPersistenceError = error;
        }

        try {
          if (attachment) {
            await isolation.restoreAttachment(attachment);
          }

          await restoreExperimentTargets();
          if (!(await oracle.waitForHealthy(60000))) {
            throw new Error("Restoration health verification failed.");
          }

          await probeWorkloadFixture(fixture);
          restorationVerified = true;
          if (workloadPersistenceError) {
            await experiments.invalidateExperimentRun(
              run.id,
              "Workload evidence persistence failed.",
            );
          }

          await prisma.experimentRunManifest.update({
            where: { runId: run.id },
            data: {
              restoration: {
                status: "verified",
                attachment: attachment ?? null,
                verifiedAt: new Date().toISOString(),
              },
            },
          });
        } catch (error) {
          await prisma.experimentRunManifest.update({
            where: { runId: run.id },
            data: {
              restoration: {
                status: "failed",
                attachment: attachment ?? null,
                error: error instanceof Error ? error.message : "Restoration failed",
              },
            },
          });
          await experiments.invalidateExperimentRun(
            run.id,
            "Restoration failed; exclusive lock retained for operator repair.",
          );
          throw error;
        } finally {
          if (restorationVerified) {
            await prisma.experimentRun.update({
              where: { id: run.id },
              data: { activeLockKey: null },
            });
          }

          await writeFile(
            resolve(output, `${run.id}.json`),
            JSON.stringify(
              await prisma.experimentRun.findUnique({
                where: { id: run.id },
                include: { manifest: true },
              }),
              null,
              2,
            ),
          );
        }
      }

      console.log({ runId: run.id, failed, restorationVerified });
    }

    await experiments.completeExperimentBatch(batch.id);
  } catch (error) {
    if (batchId) {
      await experiments.completeExperimentBatch(batchId, "failed");
    }

    throw error;
  } finally {
    if (batchId) {
      const evidence = await experiments.getExperimentEvidence(batchId);

      await writeExperimentReport({
        report: createExperimentReport(evidence.batch, evidence.runs),
        outputDirectory: output,
      });
      const episodes = await prisma.recoveryEpisode.findMany({
        where: { experimentRunId: { in: evidence.runs.map((run) => run.id) } },
        include: { steps: { orderBy: { diagnosisReadyAt: "asc" } } },
      });

      await writeFile(
        resolve(output, "recovery-stages.json"),
        JSON.stringify({ measurementVersion: "2.0.0", episodes }, null, 2),
      );
    }

    await prisma.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Panel failed");
  process.exitCode = 1;
});
