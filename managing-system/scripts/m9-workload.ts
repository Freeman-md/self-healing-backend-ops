import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  createWorkloadFixture,
  cleanupWorkloadFixture,
  workloadFixtureSchema,
  workloadSettingsSchema,
  startBoundedWorkload,
  summarizeWorkload,
  probeWorkloadFixture,
} from "./experiment/workload";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      operation: { type: "string" },
      file: { type: "string" },
      "base-url": { type: "string" },
      settings: { type: "string" },
      output: { type: "string" },
    },
    strict: true,
  });

  if (!values.file) {
    throw new Error("--file is required.");
  }

  if (values.operation === "setup") {
    if (!values["base-url"]) {
      throw new Error("--base-url is required.");
    }

    // Refuse to overwrite ownership evidence from a previous fixture.
    await writeFile(values.file, JSON.stringify({ status: "creating" }), { flag: "wx" });
    await createWorkloadFixture(values["base-url"], async (fixture) => {
      await writeFile(values.file!, JSON.stringify(fixture, null, 2));
    });

    return;
  }

  const fixture = workloadFixtureSchema.parse(JSON.parse(await readFile(values.file, "utf8")));

  if (values.operation === "cleanup") {
    await cleanupWorkloadFixture(fixture);

    return;
  }

  if (values.operation !== "calibrate" || !values.settings || !values.output) {
    throw new Error("Use setup, cleanup, or calibrate with --settings and --output.");
  }

  const settings = workloadSettingsSchema.parse(
    JSON.parse(await readFile(values.settings, "utf8")),
  );

  await probeWorkloadFixture(fixture);
  const traffic = startBoundedWorkload({ fixture, settings });

  const durationMs = settings.warmupMs + 30000;

  if (durationMs > settings.maximumDurationMs) {
    throw new Error("Calibration exceeds workload duration bound.");
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const endedAt = Date.now();

  const samples = await traffic.stop();

  const metrics = summarizeWorkload(samples, traffic.startedAt + settings.warmupMs, endedAt);

  const passed =
    metrics.success === metrics.achievedCount &&
    metrics.capacitySkipped === 0 &&
    metrics.achievedRate >= settings.offeredRate * 0.95;

  await writeFile(
    values.output,
    JSON.stringify(
      {
        version: "m9-calibration-1.0.0",
        fixture,
        settings,
        metrics,
        samples,
        passed,
        calibratedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  if (!passed) {
    throw new Error(
      "Calibration failed; lower offered rate prospectively and recalibrate into a new file.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Workload operation failed");
  process.exitCode = 1;
});
