import { config } from "@/config";
import { RawEvidenceCollector } from "@/modules/evidence";

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
}

main().catch((error: unknown) => {
  console.error({
    event: "managing_system_failed",
    error: error instanceof Error ? error.message : "unknown error",
  });

  process.exitCode = 1;
});
