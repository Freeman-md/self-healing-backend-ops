import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBatchSummary, writeSuiteReport } from "../../../scripts/run-experiment-suite";

for (const version of ["v1", "v2", undefined] as const) {
  test(`suite exports retain frozen agent identity: ${version ?? "historical"}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "milestone8-suite-"));

    try {
      await mkdir(join(directory, "agent", "batch"), { recursive: true });
      const configuration = version
        ? {
            agentStrategyVersion: version,
            agentImplementationVersion: version === "v2" ? "2.0.0" : "1.0.0",
            agentPromptVersion: version === "v2" ? "2.0.0" : "1.0.0",
          }
        : {};

      await writeFile(
        join(directory, "agent", "batch", "experiment.json"),
        JSON.stringify({
          batch: { id: "batch", configuration },
          summary: {
            totalRuns: 0,
            validRuns: 0,
            invalidRuns: 0,
            verifiedRecoveries: 0,
            automaticResolutions: 0,
            runtimeOracleDisagreements: 0,
            safetyMaintainedRuns: 0,
            timing: {},
            model: { callCount: 0, totalTokens: 0 },
          },
        }),
      );
      const batch = await readBatchSummary(join(directory, "agent"), "agent");

      await writeSuiteReport({
        phase: "validation",
        sourceRevision: "head",
        campaignId: "campaign",
        campaignDirectory: directory,
        healthyControls: [],
        batches: [batch],
      });
      const manifest = JSON.parse(await readFile(join(directory, "suite-manifest.json"), "utf8"));

      assert.equal(manifest.batches[0].agentStrategyVersion, version ?? null);
      assert.equal(
        manifest.batches[0].agentImplementationVersion,
        configuration.agentImplementationVersion ?? null,
      );
      assert.equal(
        manifest.batches[0].agentPromptVersion,
        configuration.agentPromptVersion ?? null,
      );
      const summary = await readFile(join(directory, "suite-summary.md"), "utf8");

      assert.ok(
        summary.includes(
          `| agent | ${version ?? "not recorded"} | ${configuration.agentImplementationVersion ?? "not recorded"} | ${configuration.agentPromptVersion ?? "not recorded"} |`,
        ),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
