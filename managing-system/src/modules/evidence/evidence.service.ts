import { config } from "@/config";
import type { IContainerStateReader } from "@/infrastructure/container-runtime";
import { canUseOpenAI, OpenAIService, type OpenAITelemetryContext } from "@/infrastructure/openai";
import {
  evidenceSnapshotSchema,
  type EvidenceSignal,
  type EvidenceSnapshot,
  type IncidentTypeCode,
} from "./evidence.schema";
import { EvidenceFactory } from "./evidence.factory";

import type { RawEvidence, RawEvidenceSource } from "./evidence.schema";

export type ManagedSystemHealthWaitResult = {
  healthy: boolean;
  attempts: number;
  startedAt: string;
  completedAt: string;
  lastStatusCode: number | null;
  lastError: string | null;
};

type EvidenceServiceOptions = {
  healthTimeoutMs?: number;
  healthPollIntervalMs?: number;
  fetchImplementation?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

type ContainerStateReader = Pick<IContainerStateReader, "inspectTarget">;
type Awaitable<T> = T | Promise<T>;
type EvidencePersistence = {
  saveRawEvidence?(rawEvidence: RawEvidence): Awaitable<RawEvidence>;
  saveEvidenceSnapshot(snapshot: EvidenceSnapshot): Awaitable<EvidenceSnapshot>;
  findEvidenceSnapshotById(snapshotId: string): Awaitable<EvidenceSnapshot | null>;
};

type EvidenceEndpoint = {
  source: Extract<RawEvidenceSource, "health" | "metrics">;
  path: string;
};

const evidenceEndpoints: EvidenceEndpoint[] = [
  {
    source: "health",
    path: "/health",
  },
  {
    source: "metrics",
    path: "/metrics",
  },
];

export class EvidenceService {
  constructor(
    private readonly evidenceRepository: EvidencePersistence,
    private readonly openaiService?: OpenAIService,
    private readonly evidenceFactory = new EvidenceFactory(),
    private readonly options: EvidenceServiceOptions = {},
    private readonly containerStateReader?: ContainerStateReader,
  ) {}

  async collectRawEvidence(): Promise<RawEvidence[]> {
    const endpointEvidence = await Promise.all(
      evidenceEndpoints.map((endpoint) => this.collectFromEndpoint(endpoint)),
    );

    const containerEvidence = await Promise.all([
      this.collectContainerState("managed-system"),
      this.collectContainerState("postgres"),
    ]);

    const collectedEvidence = [...endpointEvidence, ...containerEvidence];

    if (this.evidenceRepository.saveRawEvidence) {
      await Promise.all(
        collectedEvidence.map((item) => this.evidenceRepository.saveRawEvidence?.(item)),
      );
    }

    return collectedEvidence;
  }

  async normalizeEvidence(
    rawEvidence: RawEvidence[],
    telemetryContext?: Pick<OpenAITelemetryContext, "trialRecordId">,
  ): Promise<EvidenceSnapshot> {
    const createdAt = new Date().toISOString();

    const deterministicSignals = this.deriveDeterministicSignals(rawEvidence);

    if (!this.openaiService && !canUseOpenAI()) {
      return this.createDeterministicSnapshot(rawEvidence, deterministicSignals, createdAt);
    }

    const openaiService = this.openaiService ?? new OpenAIService();

    const llmSnapshot = await openaiService.parseStructuredOutput({
      schema: evidenceSnapshotSchema,
      schemaName: "evidence_snapshot",
      systemPrompt:
        "Normalize raw operational evidence into a structured snapshot. Do not recommend actions.",
      userPrompt: JSON.stringify({
        requiredSnapshotValues: {
          id: `snapshot-${createdAt}`,
          rawEvidenceIds: rawEvidence.map((item) => item.id),
          createdAt,
          targetSystem: "managed-system",
        },
        rawEvidence,
      }),
      telemetryContext: {
        operation: "evidence_normalization",
        trialRecordId: telemetryContext?.trialRecordId,
        evidenceSnapshotId: `snapshot-${createdAt}`,
      },
    });

    const deterministicCodes = new Set(deterministicSignals.map((signal) => signal.code));

    const supplementarySignals = llmSnapshot.signals.map((signal) => ({
      ...signal,
      code: deterministicCodes.has(signal.code) ? ("unknown" as const) : signal.code,
      method: "llm" as const,
    }));

    const snapshot = evidenceSnapshotSchema.parse({
      ...llmSnapshot,
      signals: [...deterministicSignals, ...supplementarySignals],
      suspectedIncidentTypes: this.deriveIncidentCodes(deterministicSignals),
    });

    return snapshot;
  }

  private createDeterministicSnapshot(
    rawEvidence: RawEvidence[],
    signals: EvidenceSignal[],
    createdAt: string,
  ): EvidenceSnapshot {
    const overallState = signals.some((signal) => signal.status === "critical")
      ? "unhealthy"
      : signals.some((signal) => signal.status === "unknown")
        ? "unknown"
        : signals.some((signal) => signal.status === "warning")
          ? "degraded"
          : "healthy";

    return evidenceSnapshotSchema.parse({
      id: `snapshot-${createdAt}`,
      rawEvidenceIds: rawEvidence.map((item) => item.id),
      createdAt,
      targetSystem: "managed-system",
      overallState,
      summary: `Deterministic monitoring observation: ${overallState}.`,
      signals,
      suspectedIncidentTypes: this.deriveIncidentCodes(signals),
      contradictions: [],
    });
  }

  async collectAndNormalize(
    telemetryContext?: Pick<OpenAITelemetryContext, "trialRecordId">,
  ): Promise<EvidenceSnapshot> {
    return this.normalizeEvidence(await this.collectRawEvidence(), telemetryContext);
  }

  async waitForManagedSystemHealth(): Promise<ManagedSystemHealthWaitResult> {
    const startedAt = new Date().toISOString();

    const startedAtMs = this.now();

    const timeoutMs = this.options.healthTimeoutMs ?? config.actions.postActionHealthTimeoutMs;

    const pollIntervalMs =
      this.options.healthPollIntervalMs ?? config.actions.postActionHealthPollIntervalMs;

    const deadlineMs = startedAtMs + timeoutMs;

    let attempts = 0;

    let lastStatusCode: number | null = null;

    let lastError: string | null = null;

    while (true) {
      const remainingHealthBudgetMs = deadlineMs - this.now();

      if (remainingHealthBudgetMs <= 0) {
        break;
      }

      attempts += 1;
      try {
        const response = await this.fetchImplementation()(this.buildTargetUrl("/health"), {
          signal: AbortSignal.timeout(
            Math.min(config.managedSystem.requestTimeoutMs, remainingHealthBudgetMs),
          ),
        });

        lastStatusCode = response.status;
        const body: unknown = await response.json();

        const isHealthy =
          typeof body === "object" &&
          body !== null &&
          "status" in body &&
          body.status === "healthy";

        if (response.ok && isHealthy) {
          return {
            healthy: true,
            attempts,
            startedAt,
            completedAt: new Date().toISOString(),
            lastStatusCode,
            lastError: null,
          };
        }

        lastError = response.ok
          ? "health response did not report healthy"
          : `request failed with status ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "unknown health polling error";
      }

      const remainingSleepBudgetMs = deadlineMs - this.now();

      if (remainingSleepBudgetMs <= 0) {
        break;
      }

      await this.sleep(Math.min(pollIntervalMs, remainingSleepBudgetMs));
    }

    return {
      healthy: false,
      attempts,
      startedAt,
      completedAt: new Date().toISOString(),
      lastStatusCode,
      lastError,
    };
  }

  async saveEvidenceSnapshot(snapshot: EvidenceSnapshot): Promise<EvidenceSnapshot> {
    return this.evidenceRepository.saveEvidenceSnapshot(snapshot);
  }

  async findEvidenceSnapshotById(snapshotId: string): Promise<EvidenceSnapshot | null> {
    return this.evidenceRepository.findEvidenceSnapshotById(snapshotId);
  }

  private async collectFromEndpoint(endpoint: EvidenceEndpoint): Promise<RawEvidence> {
    const collectedAt = new Date().toISOString();

    const target = this.buildTargetUrl(endpoint.path);

    try {
      const response = await this.fetchImplementation()(target, {
        signal: AbortSignal.timeout(config.managedSystem.requestTimeoutMs),
      });

      const rawText = await response.text();

      if (!response.ok) {
        return this.evidenceFactory.createFailedRawEvidence({
          source: endpoint.source,
          target,
          collectedAt,
          rawText,
          error: `request failed with status ${response.status}`,
        });
      }

      return this.evidenceFactory.createCollectedRawEvidence({
        source: endpoint.source,
        target,
        collectedAt,
        rawText,
      });
    } catch (error) {
      return this.evidenceFactory.createFailedRawEvidence({
        source: endpoint.source,
        target,
        collectedAt,
        rawText: null,
        error: error instanceof Error ? error.message : "unknown collection error",
      });
    }
  }

  private async collectContainerState(target: "managed-system" | "postgres"): Promise<RawEvidence> {
    const collectedAt = new Date().toISOString();

    const containerName =
      target === "managed-system" ? "managed-system-app" : "managed-system-postgres";

    if (!this.containerStateReader) {
      return this.evidenceFactory.createFailedRawEvidence({
        source: "container",
        target: containerName,
        collectedAt,
        rawText: null,
        error: "Container state reader is unavailable.",
      });
    }

    try {
      const result = await this.containerStateReader.inspectTarget(target);

      return this.evidenceFactory.createCollectedRawEvidence({
        source: "container",
        target: result.containerName,
        collectedAt,
        rawText: result.state,
      });
    } catch (error) {
      return this.evidenceFactory.createFailedRawEvidence({
        source: "container",
        target: containerName,
        collectedAt,
        rawText: null,
        error: error instanceof Error ? error.message : "Container inspection failed.",
      });
    }
  }

  private deriveDeterministicSignals(rawEvidence: RawEvidence[]): EvidenceSignal[] {
    const health = rawEvidence.find((item) => item.source === "health");

    const metrics = rawEvidence.find((item) => item.source === "metrics");

    const managedContainer = rawEvidence.find(
      (item) => item.source === "container" && item.target === "managed-system-app",
    );

    const postgresContainer = rawEvidence.find(
      (item) => item.source === "container" && item.target === "managed-system-postgres",
    );

    const healthBody = this.parseJson(health?.rawText);

    const healthStatus = this.readStringProperty(healthBody, "status");

    const databaseStatus = this.readNestedStringProperty(
      healthBody,
      "checks",
      "database",
      "status",
    );

    return [
      this.createDeterministicSignal(
        "managed_system_reachability",
        "health",
        health?.status === "collected" ? "normal" : "critical",
        health?.status === "collected",
        "Managed-system health endpoint reachability.",
      ),
      this.createDeterministicSignal(
        "managed_system_health",
        "health",
        healthStatus === "healthy" ? "normal" : healthStatus ? "critical" : "unknown",
        healthStatus ?? null,
        "Managed-system reported health status.",
      ),
      this.createDeterministicSignal(
        "database_connectivity",
        "health",
        databaseStatus === "healthy"
          ? "normal"
          : databaseStatus === "unhealthy"
            ? "critical"
            : "unknown",
        databaseStatus ?? null,
        "Database connectivity status reported by the managed system.",
      ),
      this.createDeterministicSignal(
        "metrics_availability",
        "metrics",
        metrics?.status === "collected" ? "normal" : "critical",
        metrics?.status === "collected",
        "Metrics endpoint availability.",
      ),
      this.createContainerSignal(
        "managed_system_container_state",
        managedContainer,
        "Managed-system application container state.",
      ),
      this.createContainerSignal(
        "postgres_container_state",
        postgresContainer,
        "PostgreSQL container state.",
      ),
    ];
  }

  private createContainerSignal(
    code: Extract<
      EvidenceSignal["code"],
      "managed_system_container_state" | "postgres_container_state"
    >,
    evidence: RawEvidence | undefined,
    description: string,
  ): EvidenceSignal {
    const state = evidence?.status === "collected" ? evidence.rawText : null;

    const status =
      state === "running"
        ? "normal"
        : state === "stopped" || state === "exited"
          ? "critical"
          : state === "restarting"
            ? "warning"
            : "unknown";

    return this.createDeterministicSignal(code, "container", status, state, description);
  }

  private createDeterministicSignal(
    code: EvidenceSignal["code"],
    source: EvidenceSignal["source"],
    status: EvidenceSignal["status"],
    value: EvidenceSignal["value"],
    description: string,
  ): EvidenceSignal {
    return { code, source, name: code, status, value, description, method: "deterministic" };
  }

  private deriveIncidentCodes(signals: EvidenceSignal[]): IncidentTypeCode[] {
    const signal = (code: EvidenceSignal["code"]) => signals.find((item) => item.code === code);

    const incidentCodes: IncidentTypeCode[] = [];

    if (signal("postgres_container_state")?.status === "critical") {
      incidentCodes.push("postgres_unavailable");
    }

    if (signal("database_connectivity")?.status === "critical") {
      incidentCodes.push("database_connectivity_failure");
    }

    if (signal("managed_system_reachability")?.status === "critical") {
      incidentCodes.push("managed_system_unreachable");
    }

    if (signal("managed_system_health")?.status === "critical") {
      incidentCodes.push("managed_system_service_down");
    }

    return incidentCodes.length > 0 ? incidentCodes : ["unclassified"];
  }

  private parseJson(rawText: string | null | undefined): unknown {
    if (!rawText) {
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  }

  private readStringProperty(value: unknown, key: string): string | null {
    if (typeof value !== "object" || value === null || !(key in value)) {
      return null;
    }

    const property = (value as Record<string, unknown>)[key];

    return typeof property === "string" ? property : null;
  }

  private readNestedStringProperty(value: unknown, ...keys: string[]): string | null {
    let current: unknown = value;

    for (const key of keys) {
      if (typeof current !== "object" || current === null || !(key in current)) {
        return null;
      }

      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === "string" ? current : null;
  }

  private buildTargetUrl(path: string): string {
    return new URL(path, config.managedSystem.baseUrl).toString();
  }

  private fetchImplementation(): typeof fetch {
    return this.options.fetchImplementation ?? fetch;
  }

  private sleep(milliseconds: number): Promise<void> {
    return (
      this.options.sleep?.(milliseconds) ??
      new Promise((resolve) => setTimeout(resolve, milliseconds))
    );
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}
