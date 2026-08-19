import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import {
  ExperimentRepository,
  ExperimentService,
  createExperimentCsv,
  createExperimentEvidencePackage,
  createExperimentMarkdown,
} from "../src/modules/experiment/index";

async function main(): Promise<void> {
  const batchId = process.argv[2];
  const outputDirectory = resolve(
    process.argv[3] ?? "/managing-system/experiment-output",
    batchId ?? "",
  );
  if (!batchId) {
    throw new Error("Usage: npm run experiment:export -- <batch-id> [output-directory]");
  }

  const prisma = new PrismaService();
  await prisma.open();
  try {
    const evidence = await new ExperimentService(
      new ExperimentRepository(prisma),
    ).getExperimentEvidence(batchId);
    const evidencePackage = createExperimentEvidencePackage(
      evidence.batch,
      evidence.runs,
    );
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        resolve(outputDirectory, "experiment.json"),
        JSON.stringify(evidencePackage, null, 2),
      ),
      writeFile(
        resolve(outputDirectory, "runs.csv"),
        createExperimentCsv(evidence.runs),
      ),
      writeFile(
        resolve(outputDirectory, "summary.md"),
        createExperimentMarkdown(evidencePackage),
      ),
    ]);
    console.log({ event: "experiment_exported", batchId, outputDirectory });
  } finally {
    await prisma.close();
  }
}

main().catch((error: unknown) => {
  console.error({
    event: "experiment_export_failed",
    error: error instanceof Error ? error.message : "unknown export error",
  });
  process.exitCode = 1;
});
