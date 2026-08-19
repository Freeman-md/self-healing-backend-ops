import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ExperimentBatch, ExperimentRunReportData } from "./experiment.types";

export type ExperimentReport = {
  batch: ExperimentBatch;
  runs: ExperimentRunReportData[];
  summary: ExperimentSummary;
};

export type ExperimentSummary = {
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  verifiedRecoveries: number;
  automaticResolutions: number;
  runtimeOracleDisagreements: number;
  diagnosisCorrectRuns: number;
  actionSequenceCorrectRuns: number;
  safetyMaintainedRuns: number;
  rates: {
    verifiedRecovery: number | null;
    automaticResolution: number | null;
    diagnosisCorrect: number | null;
    actionSequenceCorrect: number | null;
    safetyMaintained: number | null;
  };
  exclusions: Record<string, number>;
  timing: Record<string, StatisticalSummary>;
  counts: Record<string, StatisticalSummary>;
  model: {
    callCount: number;
    failedCallCount: number;
    latencyMs: StatisticalSummary | null;
    totalTokens: number;
    tokenUsage: {
      inputTokens: StatisticalSummary | null;
      outputTokens: StatisticalSummary | null;
      totalTokens: StatisticalSummary | null;
    };
  };
};

export type StatisticalSummary = {
  count: number;
  mean: number;
  median: number;
  standardDeviation: number;
  interquartileRange: number;
  minimum: number;
  maximum: number;
};

export function createExperimentReport(
  batch: ExperimentBatch,
  runs: ExperimentRunReportData[],
): ExperimentReport {
  return { batch, runs, summary: createExperimentSummary(runs) };
}

export function createExperimentSummary(runs: ExperimentRunReportData[]): ExperimentSummary {
  const validRuns = runs.filter((run) => run.valid === true);

  const invocations = validRuns.flatMap((run) => run.trial?.modelInvocations ?? []);

  const verifiedRecoveries = validRuns.filter((run) => run.oracleSucceeded).length;

  const automaticResolutions = validRuns.filter((run) => run.runtimeResolved).length;

  const diagnosisCorrectRuns = validRuns.filter((run) => run.diagnosisCorrect).length;

  const actionSequenceCorrectRuns = validRuns.filter((run) => run.actionSequenceCorrect).length;

  const safetyMaintainedRuns = validRuns.filter((run) => run.trial?.safetyMaintained).length;

  const timingValues: Record<string, number[]> = {
    faultToDetectionMs: values(validRuns, (run) => run.faultToDetectionMs),
    timeToHealMs: values(validRuns, (run) => run.timeToHealMs),
    timeToTerminationMs: values(validRuns, (run) => run.timeToTerminationMs),
    unhealthyConfirmationDelayMs: values(
      validRuns,
      (run) => run.trial?.measurement?.unhealthyConfirmationDelayMs,
    ),
    timeToFirstActionMs: values(validRuns, (run) => run.trial?.measurement?.timeToFirstActionMs),
    recoveryLoopDurationMs: values(
      validRuns,
      (run) => run.trial?.measurement?.recoveryLoopDurationMs,
    ),
    observedTimeToHealMs: values(validRuns, (run) => run.trial?.measurement?.observedTimeToHealMs),
  };

  const countValues: Record<string, number[]> = {
    decisionCount: values(validRuns, (run) => run.trial?.measurement?.decisionCount),
    actionCount: values(validRuns, (run) => run.trial?.actionCount),
    successfulActionCount: values(validRuns, (run) => {
      if (!run.trial) {
        return null;
      }

      return Math.max(
        0,
        run.trial.actionCount - run.trial.blockedActionCount - run.trial.failedActionCount,
      );
    }),
    blockedActionCount: values(validRuns, (run) => run.trial?.blockedActionCount),
    failedActionCount: values(validRuns, (run) => run.trial?.failedActionCount),
    unnecessaryActionCount: values(validRuns, (run) => run.unnecessaryActionCount),
  };

  return {
    totalRuns: runs.length,
    validRuns: validRuns.length,
    invalidRuns: runs.length - validRuns.length,
    verifiedRecoveries,
    automaticResolutions,
    runtimeOracleDisagreements: validRuns.filter(
      (run) => run.runtimeResolved !== run.oracleSucceeded,
    ).length,
    diagnosisCorrectRuns,
    actionSequenceCorrectRuns,
    safetyMaintainedRuns,
    rates: {
      verifiedRecovery: rate(verifiedRecoveries, validRuns.length),
      automaticResolution: rate(automaticResolutions, validRuns.length),
      diagnosisCorrect: rate(diagnosisCorrectRuns, validRuns.length),
      actionSequenceCorrect: rate(actionSequenceCorrectRuns, validRuns.length),
      safetyMaintained: rate(safetyMaintainedRuns, validRuns.length),
    },
    exclusions: runs
      .filter((run) => run.valid !== true)
      .reduce<Record<string, number>>((counts, run) => {
        const reason = run.exclusionReason ?? "Unspecified exclusion";

        counts[reason] = (counts[reason] ?? 0) + 1;

        return counts;
      }, {}),
    timing: Object.fromEntries(
      Object.entries(timingValues)
        .map(([name, measurements]) => [name, summarize(measurements)])
        .filter((entry): entry is [string, StatisticalSummary] => entry[1] !== null),
    ),
    counts: Object.fromEntries(
      Object.entries(countValues)
        .map(([name, measurements]) => [name, summarize(measurements)])
        .filter((entry): entry is [string, StatisticalSummary] => entry[1] !== null),
    ),
    model: {
      callCount: invocations.length,
      failedCallCount: invocations.filter((invocation) => invocation.status === "failed").length,
      latencyMs: summarize(invocations.map((invocation) => invocation.durationMs)),
      totalTokens: invocations.reduce(
        (total, invocation) => total + (invocation.totalTokens ?? 0),
        0,
      ),
      tokenUsage: {
        inputTokens: summarize(present(invocations.map((invocation) => invocation.inputTokens))),
        outputTokens: summarize(present(invocations.map((invocation) => invocation.outputTokens))),
        totalTokens: summarize(present(invocations.map((invocation) => invocation.totalTokens))),
      },
    },
  };
}

export function createExperimentCsv(runs: ExperimentRunReportData[]): string {
  const columns = [
    "runId",
    "batchId",
    "recoveryMode",
    "faultProfile",
    "repetition",
    "valid",
    "status",
    "runtimeResolved",
    "oracleSucceeded",
    "diagnosisCorrect",
    "actionSequenceCorrect",
    "unnecessaryActionCount",
    "faultToDetectionMs",
    "timeToHealMs",
    "timeToTerminationMs",
    "unhealthyConfirmationDelayMs",
    "timeToFirstActionMs",
    "recoveryLoopDurationMs",
    "observedTimeToHealMs",
    "decisionCount",
    "actionCount",
    "blockedActionCount",
    "failedActionCount",
    "successfulActionCount",
    "safetyMaintained",
    "modelCallCount",
    "modelTotalTokens",
    "exclusionReason",
  ];

  const rows = runs.map((run) => [
    run.id,
    run.batchId,
    run.recoveryMode,
    run.faultProfile,
    run.repetition,
    run.valid,
    run.status,
    run.runtimeResolved,
    run.oracleSucceeded,
    run.diagnosisCorrect,
    run.actionSequenceCorrect,
    run.unnecessaryActionCount,
    run.faultToDetectionMs,
    run.timeToHealMs,
    run.timeToTerminationMs,
    run.trial?.measurement?.unhealthyConfirmationDelayMs,
    run.trial?.measurement?.timeToFirstActionMs,
    run.trial?.measurement?.recoveryLoopDurationMs,
    run.trial?.measurement?.observedTimeToHealMs,
    run.trial?.measurement?.decisionCount,
    run.trial?.actionCount,
    run.trial?.blockedActionCount,
    run.trial?.failedActionCount,
    run.trial
      ? Math.max(
          0,
          run.trial.actionCount - run.trial.blockedActionCount - run.trial.failedActionCount,
        )
      : null,
    run.trial?.safetyMaintained,
    run.trial?.modelInvocations.length ?? 0,
    run.trial?.modelInvocations.reduce(
      (total, invocation) => total + (invocation.totalTokens ?? 0),
      0,
    ) ?? 0,
    run.exclusionReason,
  ]);

  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function createExperimentMarkdown(evidence: ExperimentReport): string {
  const { batch, summary } = evidence;

  const lines = [
    `# Experiment Batch ${batch.name}`,
    "",
    `- Batch ID: \`${batch.id}\``,
    `- Source revision: \`${batch.sourceRevision}\``,
    `- Measurement version: \`${batch.measurementVersion}\``,
    `- Total runs: ${summary.totalRuns}`,
    `- Valid runs: ${summary.validRuns}`,
    `- Invalid or excluded runs: ${summary.invalidRuns}`,
    `- Verified recoveries: ${summary.verifiedRecoveries}`,
    `- Verified recovery rate: ${percentage(summary.rates.verifiedRecovery)}`,
    `- Automatic runtime resolutions: ${summary.automaticResolutions}`,
    `- Automatic resolution rate: ${percentage(summary.rates.automaticResolution)}`,
    `- Runtime/oracle disagreements: ${summary.runtimeOracleDisagreements}`,
    `- Correct diagnoses: ${summary.diagnosisCorrectRuns}`,
    `- Correct action sequences: ${summary.actionSequenceCorrectRuns}`,
    `- Safety maintained: ${summary.safetyMaintainedRuns}`,
    "",
    "## Timing",
    "",
    "| Measure | N | Mean | Median | SD | IQR | Min | Max |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(summary.timing).map(
      ([name, value]) =>
        `| ${name} | ${value.count} | ${round(value.mean)} | ${round(value.median)} | ${round(value.standardDeviation)} | ${round(value.interquartileRange)} | ${value.minimum} | ${value.maximum} |`,
    ),
    "",
    "## Decisions and Actions",
    "",
    "| Measure | N | Mean | Median | SD | IQR | Min | Max |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(summary.counts).map(
      ([name, value]) =>
        `| ${name} | ${value.count} | ${round(value.mean)} | ${round(value.median)} | ${round(value.standardDeviation)} | ${round(value.interquartileRange)} | ${value.minimum} | ${value.maximum} |`,
    ),
    "",
    "## Exclusions",
    "",
    ...(Object.keys(summary.exclusions).length === 0
      ? ["No runs were excluded."]
      : Object.entries(summary.exclusions).map(([reason, count]) => `- ${reason}: ${count}`)),
    "",
    "## Model Usage",
    "",
    `- Calls: ${summary.model.callCount}`,
    `- Failed calls: ${summary.model.failedCallCount}`,
    `- Total tokens: ${summary.model.totalTokens}`,
    `- Mean model latency: ${summary.model.latencyMs ? `${round(summary.model.latencyMs.mean)} ms` : "not available"}`,
    `- Mean tokens per recorded call: ${summary.model.tokenUsage.totalTokens ? round(summary.model.tokenUsage.totalTokens.mean) : "not available"}`,
    "",
    "Pilot results validate instrumentation only and do not establish comparative superiority.",
  ];

  return lines.join("\n");
}

export async function writeExperimentReport({
  report,
  outputDirectory,
}: {
  report: ExperimentReport;
  outputDirectory: string;
}): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all([
    writeFile(resolve(outputDirectory, "experiment.json"), JSON.stringify(report, null, 2)),
    writeFile(resolve(outputDirectory, "runs.csv"), createExperimentCsv(report.runs)),
    writeFile(resolve(outputDirectory, "summary.md"), createExperimentMarkdown(report)),
  ]);
}

export function summarize(values: number[]): StatisticalSummary | null {
  if (values.length === 0) {
    return null;
  }

  const ordered = [...values].sort((left, right) => left - right);

  const mean = ordered.reduce((total, value) => total + value, 0) / ordered.length;

  const variance =
    ordered.reduce((total, value) => total + (value - mean) ** 2, 0) / ordered.length;

  const firstQuartile = percentile(ordered, 0.25);

  const thirdQuartile = percentile(ordered, 0.75);

  return {
    count: ordered.length,
    mean,
    median: percentile(ordered, 0.5),
    standardDeviation: Math.sqrt(variance),
    interquartileRange: thirdQuartile - firstQuartile,
    minimum: ordered[0],
    maximum: ordered.at(-1)!,
  };
}

function values(
  runs: ExperimentRunReportData[],
  select: (run: ExperimentRunReportData) => number | null | undefined,
): number[] {
  return runs.map(select).filter((value): value is number => value !== null && value !== undefined);
}

function present(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null);
}

function rate(count: number, total: number): number | null {
  return total === 0 ? null : count / total;
}

function percentile(ordered: number[], percentileValue: number): number {
  const index = (ordered.length - 1) * percentileValue;

  const lower = Math.floor(index);

  const upper = Math.ceil(index);

  if (lower === upper) {
    return ordered[lower];
  }

  return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function round(value: number): string {
  return value.toFixed(2);
}

function percentage(value: number | null): string {
  return value === null ? "not available" : `${round(value * 100)}%`;
}
