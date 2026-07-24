import { config } from "@/config";
import { OpenAIService } from "@/infrastructure/openai";
import { evidenceSnapshotSchema, type EvidenceSnapshot } from "./evidence.schema";
import { EvidenceRepository } from "./evidence.repository";
import { EvidenceFactory } from "./evidence.factory";

import type { RawEvidence, RawEvidenceSource } from "./evidence.schema";

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
      const response = await fetch(target, {
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
}
