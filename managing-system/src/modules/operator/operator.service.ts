import type { AttentionService } from "@/modules/attention";
import type { ControlledTestRequest, OperatorListTrialsQuery } from "./operator.schema";
import { OperatorRepository } from "./operator.repository";
import type { ControlledTestRunner, OperatorRuntime, OperatorStrategy } from "./operator.types";

export class OperatorUnavailableError extends Error {
  constructor(message = "The operator control plane is temporarily unavailable.") {
    super(message);
  }
}

export class OperatorService {
  constructor(
    private readonly repository: OperatorRepository,
    private readonly attention: Pick<
      AttentionService,
      "listAttention" | "readAttention" | "acknowledgeAttention" | "reviewAttention"
    >,
    private readonly runtime: OperatorRuntime,
    private readonly runner: ControlledTestRunner,
    private readonly options: {
      monitoringIntervalMs: number;
      dockerActionsEnabled: boolean;
      agentAvailable: boolean;
      reuseAvailable: boolean;
      sourceRevision: string;
    },
  ) {}

  async readState() {
    const serverTime = new Date().toISOString();

    const runtime = this.runtime.status();

    try {
      const [latest, active] = await Promise.all([
        this.repository.findLatestEvidence(),
        this.repository.readActiveRun(),
      ]);

      const evidence = latest
        ? {
            id: latest.id,
            observedAt: latest.createdAt.toISOString(),
            freshness:
              Date.now() - latest.createdAt.getTime() <= this.options.monitoringIntervalMs * 2
                ? ("fresh" as const)
                : ("stale" as const),
            overallState: deterministicState(latest.signals),
            summary: latest.summary,
            signals: latest.signals
              .filter((signal) => signal.method === "deterministic")
              .map((signal) => ({
                code: signal.code,
                label: signal.name,
                status:
                  signal.status === "normal"
                    ? "healthy"
                    : signal.status === "warning"
                      ? "degraded"
                      : signal.status === "critical"
                        ? "unhealthy"
                        : "unknown",
                value: displaySignal(signal.value),
                description: signal.description,
              })),
            contradictions: stringList(latest.contradictions),
          }
        : null;

      const strategies = this.strategies();

      const readiness = this.readiness({
        evidence,
        runtimeState: runtime.state,
        activeRunId: active?.id ?? null,
        strategies,
      });

      return {
        serverTime,
        controlPlane: { status: "available" as const, message: null },
        evidence,
        monitor: {
          state: runtime.state,
          heartbeatAt: runtime.heartbeatAt,
          activeRunId: active?.id ?? null,
          strategy: runtime.strategy,
          readiness,
        },
        strategies,
        workloads: [
          { id: "idle" as const, label: "Idle local workload", ready: true, reason: null },
        ],
      };
    } catch {
      const strategies = this.strategies();

      return {
        serverTime,
        controlPlane: {
          status: "unavailable" as const,
          message:
            "Persisted operator state could not be read. Current health and write readiness are unknown.",
        },
        evidence: null,
        monitor: {
          state: "unavailable" as const,
          heartbeatAt: runtime.heartbeatAt,
          activeRunId: null,
          strategy: runtime.strategy,
          readiness: { canLaunch: false, reasons: ["The persisted control plane is unavailable."] },
        },
        strategies,
        workloads: [
          {
            id: "idle" as const,
            label: "Idle local workload",
            ready: false,
            reason: "The persisted control plane is unavailable.",
          },
        ],
      };
    }
  }

  listTrials(query: OperatorListTrialsQuery) {
    return this.repository.listTrials(query);
  }

  async readTrial(id: string) {
    const detail = await this.repository.findTrialDetail(id);

    if (!detail) {
      throw new OperatorUnavailableError("The requested trial was not found.");
    }

    return detail;
  }

  async listAttention() {
    const records = await this.attention.listAttention();

    return records.map((record) => attentionDto(record));
  }

  async readAttention(id: string) {
    const record = await this.attention.readAttention(id);

    const trial = await this.repository.findTrialDetail(record.trialRecordId);

    const evidence = await this.repository.findLatestEvidence();

    return {
      ...attentionDto(record),
      initialEvidenceId: record.initialEvidenceSnapshotId,
      healthyEvidenceId: record.healthyEvidenceSnapshotId,
      currentHealth:
        evidence &&
        Date.now() - evidence.createdAt.getTime() <= this.options.monitoringIntervalMs * 2
          ? deterministicState(evidence.signals)
          : "unknown",
      trialOutcome: trial?.trial.outcome ?? "not recorded",
    };
  }

  async acknowledgeAttention(id: string) {
    await this.attention.acknowledgeAttention(id);

    return this.readAttention(id);
  }

  async reviewAttention(id: string, notes: string) {
    await this.attention.reviewAttention(id, notes);

    return this.readAttention(id);
  }

  listRecoveryCases() {
    return this.repository.listRecoveryCases();
  }

  async readRecoveryCase(id: string) {
    const entry = await this.repository.findRecoveryCase(id);

    if (!entry) {
      throw new OperatorUnavailableError(
        "The requested recovery case was not found or is no longer eligible.",
      );
    }

    return entry;
  }

  listExperiments() {
    return this.repository.listExperiments();
  }

  async readExperiment(id: string) {
    const detail = await this.repository.findExperiment(id);

    if (!detail) {
      throw new OperatorUnavailableError("The requested experiment batch was not found.");
    }

    return detail;
  }

  async launchControlledTest(input: ControlledTestRequest) {
    // Reconcile an accepted launch even while its shared lock or unhealthy evidence blocks new work.
    const accepted = await this.repository.findAcceptedOperatorRequest(input);

    if (accepted) {
      return accepted;
    }

    const state = await this.readState();

    const selected = state.strategies.find((strategy) => strategy.id === input.strategy);

    if (!selected?.ready) {
      throw new OperatorUnavailableError(selected?.reason ?? "The selected strategy is not ready.");
    }

    if (!state.monitor.readiness.canLaunch) {
      throw new OperatorUnavailableError(state.monitor.readiness.reasons.join(" "));
    }

    return this.runner.launch(input);
  }

  async readControlledTest(id: string) {
    const run = await this.repository.readControlledTestRun(id);

    if (!run || !id.startsWith("operator-run-")) {
      throw new OperatorUnavailableError("The requested controlled test was not found.");
    }

    const restoration = run.manifest?.restoration;

    const status =
      restoration && typeof restoration === "object" && !Array.isArray(restoration)
        ? restoration.status
        : null;

    return {
      id: run.id,
      status: run.status,
      trialId: run.trialRecordId,
      lockHeld: run.activeLockKey !== null,
      restoration: status === "verified" || status === "failed" ? status : "pending",
      failed: run.exclusionReason !== null,
    };
  }

  private strategies(): OperatorStrategy[] {
    const agentReady = this.options.agentAvailable;

    const reuseReady = agentReady && this.options.reuseAvailable;

    return [
      {
        id: "baseline",
        label: "Baseline",
        reuseEnabled: false,
        maxActions: 3,
        maxTurns: 3,
        ready: true,
        reason: null,
      },
      {
        id: "v1",
        label: "Agent V1",
        reuseEnabled: false,
        maxActions: 3,
        maxTurns: 3,
        ready: agentReady,
        reason: agentReady ? null : "OPENAI_API_KEY is required for Agent V1.",
      },
      {
        id: "v2",
        label: "Agent V2",
        reuseEnabled: false,
        maxActions: 3,
        maxTurns: 8,
        ready: agentReady,
        reason: agentReady ? null : "OPENAI_API_KEY is required for Agent V2.",
      },
      {
        id: "v2-reuse",
        label: "Agent V2 with reuse",
        reuseEnabled: true,
        maxActions: 3,
        maxTurns: 12,
        ready: reuseReady,
        reason: reuseReady
          ? null
          : "OPENAI_API_KEY and frozen source-trial IDs are required for reuse-enabled V2.",
      },
    ];
  }

  private readiness(input: {
    evidence: { freshness: "fresh" | "stale"; overallState: string } | null;
    runtimeState: string;
    activeRunId: string | null;
    strategies: OperatorStrategy[];
  }) {
    const reasons: string[] = [];

    if (!/^[a-f0-9]{40}$/.test(this.options.sourceRevision)) {
      reasons.push(
        "Rebuild the local image from a clean committed checkout with SOURCE_REVISION before launching tests.",
      );
    }

    if (!this.options.dockerActionsEnabled) {
      reasons.push("Docker actions are disabled.");
    }

    if (!input.evidence) {
      reasons.push("No persisted evidence snapshot is available.");
    } else if (input.evidence.freshness !== "fresh") {
      reasons.push("The latest evidence snapshot is stale.");
    } else if (input.evidence.overallState !== "healthy") {
      reasons.push(
        "The managed system must be deterministically healthy before a controlled test.",
      );
    }

    if (input.runtimeState === "recovering") {
      reasons.push("A recovery is in progress.");
    }

    if (input.runtimeState === "stopped" || input.runtimeState === "unavailable") {
      reasons.push("The monitor is not observing.");
    }

    if (input.activeRunId) {
      reasons.push(`Controlled run ${input.activeRunId} retains the shared experiment lock.`);
    }

    return { canLaunch: reasons.length === 0, reasons };
  }
}

function attentionDto(record: Awaited<ReturnType<AttentionService["readAttention"]>>) {
  return {
    id: record.id,
    trialId: record.trialRecordId,
    reason: record.reason,
    state: record.state,
    createdAt: record.createdAt.toISOString(),
    acknowledgedAt: record.acknowledgedAt?.toISOString() ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    notes: record.notes,
    releasedAt: record.releasedAt?.toISOString() ?? null,
    latestEvidenceId: record.latestEvidenceSnapshotId,
  };
}

function displaySignal(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return String(value).slice(0, 120);
  }

  return "Structured value recorded";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 20)
    : [];
}

function deterministicState(
  signals: Array<{ method: string; status: string }>,
): "healthy" | "degraded" | "unhealthy" | "unknown" {
  const deterministic = signals.filter((signal) => signal.method === "deterministic");

  if (deterministic.some((signal) => signal.status === "critical")) {
    return "unhealthy";
  }

  if (deterministic.length === 0 || deterministic.some((signal) => signal.status === "unknown")) {
    return "unknown";
  }

  if (deterministic.some((signal) => signal.status === "warning")) {
    return "degraded";
  }

  return "healthy";
}
