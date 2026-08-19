import { resolve } from "node:path";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import {
  ExperimentRepository,
  ExperimentService,
  createExperimentReport,
  writeExperimentReport,
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

    const report = createExperimentReport(evidence.batch, evidence.runs);

    await writeExperimentReport({ report, outputDirectory });
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
