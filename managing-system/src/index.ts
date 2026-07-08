import { config } from "@/config";
import { EvidenceNormalizer, RawEvidenceCollector } from "@/modules/evidence";
import { canUseOpenAI } from "@/services/openai";

async function main() {
  console.log({
    event: "managing_system_started",
    environment: config.environment,
    managedSystemBaseUrl: config.managedSystem.baseUrl,
  });

  const collector = new RawEvidenceCollector();
  const evidence = await collector.collect();

  console.log({
    event: "raw_evidence_collected",
    evidence: evidence.map((item) => ({
      id: item.id,
      source: item.source,
      target: item.target,
      status: item.status,
      error: item.error,
    })),
  });

  if (!canUseOpenAI()) {
    console.log({
      event: "evidence_normalization_skipped",
      reason: "OPENAI_API_KEY is not configured",
    });

    return;
  }

  const normalizer = new EvidenceNormalizer();
  const snapshot = await normalizer.normalize(evidence);

  console.log({
    event: "evidence_snapshot_created",
    snapshot,
  });
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });

  process.exitCode = 1;
});
