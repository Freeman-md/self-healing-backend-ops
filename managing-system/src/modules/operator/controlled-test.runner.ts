import type { FaultProfileCode } from "@/generated/prisma/client";
import {
  ApplicationNetworkIsolation,
  assertUnreachable,
  ExperimentService,
  injectFaultProfile,
  RecoveryOracle,
  restoreExperimentTargets,
} from "@/modules/experiment";
import { DockerContainerRuntimeService } from "@/infrastructure/container-runtime";

import { OperatorRepository } from "./operator.repository";
import type { ControlledTestRequest } from "./operator.schema";
import type { ControlledTestRunner, OperatorRuntime, OperatorStrategyId } from "./operator.types";

type ControlledTestRunnerOptions = {
  sourceRevision: string;
  model: string;
  targetOrigin: string;
  monitoring: { intervalMs: number; consecutiveUnhealthyThreshold: number; cooldownMs: number };
  sourceTrialIds: string[];
  compatibilityFingerprint: () => Promise<string>;
  ensureReady: () => Promise<void>;
  sleep?: (milliseconds: number) => Promise<void>;
  log?: (entry: Record<string, unknown>) => void;
};

export class LocalControlledTestRunner implements ControlledTestRunner {
  private readonly isolation = new ApplicationNetworkIsolation();

  private readonly oracle: RecoveryOracle;

  constructor(
    private readonly repository: OperatorRepository,
    private readonly experiments: ExperimentService,
    private readonly runtime: OperatorRuntime,
    private readonly options: ControlledTestRunnerOptions,
  ) {
    this.oracle = new RecoveryOracle(
      this.options.targetOrigin,
      new DockerContainerRuntimeService(),
    );
  }

  async launch(input: ControlledTestRequest) {
    await this.options.ensureReady();
    const binding = strategyBinding(input.strategy);

    const configuration = await this.createConfiguration(input, binding);

    const prepared = await this.repository.createOrReadOperatorRun({
      requestId: input.requestId,
      profile: input.profile,
      recoveryMode: binding.recoveryMode,
      configuration,
      stabilityWindowMs: 10_000,
      sourceRevision: this.options.sourceRevision,
    });

    if (!prepared.created) {
      return { requestId: input.requestId, runId: prepared.run.id, accepted: true };
    }

    try {
      await this.runtime.prepare(input.strategy);
      void this.execute(prepared.run.id, input, binding.recoveryMode);

      return { requestId: input.requestId, runId: prepared.run.id, accepted: true };
    } catch (error) {
      await this.cancelBeforeInjection(prepared.run.id, safeError(error));
      throw error;
    }
  }

  private async createConfiguration(
    input: ControlledTestRequest,
    binding: ReturnType<typeof strategyBinding>,
  ) {
    const frozen = await this.experiments.createFrozenConfiguration({
      recoveryMode: binding.recoveryMode,
      agentStrategyVersion: binding.agentStrategyVersion,
      agentImplementationVersion: binding.implementationVersion,
      agentPromptVersion: binding.implementationVersion,
      model: this.options.model,
      promptVersion: "1.0.0",
      maxRecoverySteps: 3,
      monitorIntervalMs: this.options.monitoring.intervalMs,
      consecutiveUnhealthyThreshold: this.options.monitoring.consecutiveUnhealthyThreshold,
      cooldownMs: this.options.monitoring.cooldownMs,
      faultProfiles: [input.profile],
      stabilityWindowMs: 10_000,
      preFaultSettleMs: this.options.monitoring.intervalMs * 2,
    });

    const fingerprint = await this.options.compatibilityFingerprint();

    return {
      protocol: { sourceRevision: this.options.sourceRevision, kind: "operator-controlled-v1" },
      configuration: frozen,
      expectedRecoveryMode: binding.recoveryMode,
      expectedAgentStrategyVersion: binding.agentStrategyVersion ?? "v2",
      retrievalEnabled: binding.reuseEnabled,
      sourceTrialIds: binding.reuseEnabled ? this.options.sourceTrialIds : [],
      compatibilityFingerprint: fingerprint,
      maxAgentTurns: binding.recoveryMode === "agent" ? (binding.reuseEnabled ? 12 : 8) : null,
      requestedProfile: input.profile,
      requestedWorkload: input.workload,
    };
  }

  private async execute(
    runId: string,
    input: ControlledTestRequest,
    recoveryMode: "baseline" | "agent",
  ) {
    let attachment:
      Awaited<ReturnType<ApplicationNetworkIsolation["captureAttachment"]>> | undefined;

    let restorationVerified = false;

    try {
      await restoreExperimentTargets();
      if (!(await this.oracle.waitForHealthy(60_000))) {
        throw new Error("Reset health verification failed.");
      }

      await this.sleep(this.options.monitoring.intervalMs * 2);
      if (input.profile === "managed_system_application_network_isolated") {
        attachment = await this.isolation.captureAttachment();
      }

      await this.repository.updateRunRestoration(runId, {
        status: "captured",
        attachment: attachment ?? null,
      });
      const injected = await this.experiments.markFaultInjected(runId);

      if (attachment) {
        await this.isolation.disconnectApplication(attachment);
        await assertUnreachable(this.options.targetOrigin);
      } else {
        await injectFaultProfile(input.profile as FaultProfileCode);
      }

      const trial = await this.experiments.waitForAndLinkMonitorTrial(injected);

      const oracle = attachment
        ? await this.verifyIsolationEscalation(trial.id, injected.faultInjectedAt!)
        : await this.oracle.verifyStableRecovery(10_000);

      await this.experiments.completeExperimentRun({ run: injected, trial, oracle });
    } catch (error) {
      await this.experiments
        .invalidateExperimentRun(runId, safeError(error))
        .catch(() => undefined);
      this.log({
        event: "operator_controlled_run_failed",
        runId,
        error: safeError(error),
        recoveryMode,
      });
    } finally {
      try {
        if (attachment) {
          await this.isolation.restoreAttachment(attachment);
        }

        await restoreExperimentTargets();
        if (!(await this.oracle.waitForHealthy(60_000))) {
          throw new Error("Restoration health verification failed.");
        }

        restorationVerified = true;
        await this.repository.updateRunRestoration(runId, {
          status: "verified",
          verifiedAt: new Date().toISOString(),
        });
        await this.releaseVerifiedRun(runId);
      } catch (error) {
        await this.repository
          .updateRunRestoration(runId, { status: "failed", error: safeError(error) })
          .catch(() => undefined);
        await this.experiments
          .invalidateExperimentRun(
            runId,
            "Restoration failed; exclusive lock retained for operator repair.",
          )
          .catch(() => undefined);
        this.log({
          event: "operator_controlled_restoration_failed",
          runId,
          error: safeError(error),
        });
      } finally {
        this.log({ event: "operator_controlled_run_finished", runId, restorationVerified });
      }
    }
  }

  private async verifyIsolationEscalation(trialId: string, faultInjectedAt: Date) {
    await this.isolation.verifyIsolated();
    const trial = await this.repository.findTrialDetail(trialId);

    const passed = trial?.trial.status === "escalated";

    return {
      succeeded: passed,
      firstHealthyObservedAt: null,
      checkedAt: new Date().toISOString(),
      details: {
        oracleKind: "safe_escalation",
        trialId,
        faultInjectedAt: faultInjectedAt.toISOString(),
        passed,
      },
    };
  }

  private async releaseVerifiedRun(runId: string) {
    // The shared lock is released only after target restoration and independent health verification.
    await this.repository.releaseOperatorRunLock(runId);
  }

  private async cancelBeforeInjection(runId: string, reason: string) {
    await this.repository.cancelPreparedOperatorRun(runId, reason);
  }

  private sleep(milliseconds: number) {
    return (
      this.options.sleep?.(milliseconds) ??
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
    );
  }

  private log(entry: Record<string, unknown>) {
    (this.options.log ?? console.log)(entry);
  }
}

function strategyBinding(strategy: OperatorStrategyId) {
  if (strategy === "baseline") {
    return {
      recoveryMode: "baseline" as const,
      agentStrategyVersion: undefined,
      implementationVersion: undefined,
      reuseEnabled: false,
    };
  }

  if (strategy === "v1") {
    return {
      recoveryMode: "agent" as const,
      agentStrategyVersion: "v1" as const,
      implementationVersion: "1.0.0",
      reuseEnabled: false,
    };
  }

  if (strategy === "v2") {
    return {
      recoveryMode: "agent" as const,
      agentStrategyVersion: "v2" as const,
      implementationVersion: "2.0.0",
      reuseEnabled: false,
    };
  }

  return {
    recoveryMode: "agent" as const,
    agentStrategyVersion: "v2" as const,
    implementationVersion: "2.1.0",
    reuseEnabled: true,
  };
}

function safeError(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/[\r\n\t]+/g, " ").slice(0, 500)
    : "Controlled test failed.";
}
