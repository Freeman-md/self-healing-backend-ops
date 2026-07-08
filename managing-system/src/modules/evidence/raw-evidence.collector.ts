import { config } from "@/config";
import type { RawEvidence, RawEvidenceSource } from "@/types";

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

export class RawEvidenceCollector {
  async collect(): Promise<RawEvidence[]> {
    return Promise.all(
      evidenceEndpoints.map((endpoint) => this.collectFromEndpoint(endpoint)),
    );
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
        return {
          id: this.buildEvidenceId(endpoint.source, collectedAt),
          source: endpoint.source,
          target,
          collectedAt,
          status: "failed",
          rawText,
          error: `request failed with status ${response.status}`,
        };
      }

      return {
        id: this.buildEvidenceId(endpoint.source, collectedAt),
        source: endpoint.source,
        target,
        collectedAt,
        status: "collected",
        rawText,
        error: null,
      };
    } catch (error) {
      return {
        id: this.buildEvidenceId(endpoint.source, collectedAt),
        source: endpoint.source,
        target,
        collectedAt,
        status: "failed",
        rawText: null,
        error: error instanceof Error ? error.message : "unknown collection error",
      };
    }
  }

  private buildTargetUrl(path: string): string {
    return new URL(path, config.managedSystem.baseUrl).toString();
  }

  private buildEvidenceId(source: RawEvidenceSource, collectedAt: string): string {
    return `raw-${source}-${collectedAt}`;
  }
}
