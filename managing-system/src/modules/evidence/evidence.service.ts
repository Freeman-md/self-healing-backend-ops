import { config } from "@/config";
import { OpenAIService } from "@/infrastructure/openai";
import { evidenceSnapshotSchema, type EvidenceSnapshot } from "./evidence.schema";
import { EvidenceRepository } from "./evidence.repository";
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
    private readonly evidenceRepository: Pick<
      EvidenceRepository,
      "saveEvidenceSnapshot" | "findEvidenceSnapshotById"
    >,
    private readonly openaiService?: OpenAIService,
    private readonly evidenceFactory = new EvidenceFactory(),
    private readonly options: EvidenceServiceOptions = {},
  ) {}

  async collectRawEvidence(): Promise<RawEvidence[]> {
    return Promise.all(
      evidenceEndpoints.map((endpoint) => this.collectFromEndpoint(endpoint)),
    );
  }

  async normalizeEvidence(rawEvidence: RawEvidence[]): Promise<EvidenceSnapshot> {
    const createdAt = new Date().toISOString();
    const openaiService = this.openaiService ?? new OpenAIService();

    return openaiService.parseStructuredOutput({
      schema: evidenceSnapshotSchema,
      schemaName: "evidence_snapshot",
      systemPrompt: "Normalize raw operational evidence into a structured snapshot. Do not recommend actions.",
      userPrompt: JSON.stringify({
        requiredSnapshotValues: { id: `snapshot-${createdAt}`, rawEvidenceIds: rawEvidence.map((item) => item.id), createdAt, targetSystem: "managed-system" },
        rawEvidence,
      }),
    });
  }

  async collectAndNormalize(): Promise<EvidenceSnapshot> {
    return this.normalizeEvidence(await this.collectRawEvidence());
  }

  async waitForManagedSystemHealth(): Promise<ManagedSystemHealthWaitResult> {
    const startedAt = new Date().toISOString();
    const startedAtMs = this.now();
    const timeoutMs = this.options.healthTimeoutMs ?? config.actions.postActionHealthTimeoutMs;
    const pollIntervalMs = this.options.healthPollIntervalMs ?? config.actions.postActionHealthPollIntervalMs;
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
        const isHealthy = typeof body === "object" && body !== null &&
          "status" in body && body.status === "healthy";

        if (response.ok && isHealthy) {
          return { healthy: true, attempts, startedAt, completedAt: new Date().toISOString(), lastStatusCode, lastError: null };
        }

        lastError = response.ok ? "health response did not report healthy" : `request failed with status ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "unknown health polling error";
      }

      const remainingSleepBudgetMs = deadlineMs - this.now();
      if (remainingSleepBudgetMs <= 0) {
        break;
      }

      await this.sleep(Math.min(pollIntervalMs, remainingSleepBudgetMs));
    }

    return { healthy: false, attempts, startedAt, completedAt: new Date().toISOString(), lastStatusCode, lastError };
  }

  saveEvidenceSnapshot(snapshot: EvidenceSnapshot): EvidenceSnapshot {
    return this.evidenceRepository.saveEvidenceSnapshot(snapshot);
  }

  findEvidenceSnapshotById(snapshotId: string): EvidenceSnapshot | null {
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

  private buildTargetUrl(path: string): string {
    return new URL(path, config.managedSystem.baseUrl).toString();
  }

  private fetchImplementation(): typeof fetch {
    return this.options.fetchImplementation ?? fetch;
  }

  private sleep(milliseconds: number): Promise<void> {
    return this.options.sleep?.(milliseconds) ?? new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}
