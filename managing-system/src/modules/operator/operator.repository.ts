import { Prisma, type FaultProfileCode } from "@/generated/prisma/client";
import { PrismaService } from "@/infrastructure/database";

import type { ControlledTestRequest, OperatorListTrialsQuery } from "./operator.schema";

const maxReadableText = 2_000;

const secretKey = /(?:api[-_]?key|secret|password|token|authorization|cookie|command|path|url)/i;

export class OperatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestEvidence() {
    return this.prisma.evidenceSnapshot.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        createdAt: true,
        overallState: true,
        summary: true,
        contradictions: true,
        signals: {
          select: {
            code: true,
            name: true,
            status: true,
            value: true,
            description: true,
            method: true,
          },
          orderBy: { position: "asc" },
        },
      },
    });
  }

  async listTrials(input: OperatorListTrialsQuery) {
    const cursor = decodeCursor(input.cursor);

    const search = input.search?.trim();

    const where: Prisma.TrialRecordWhereInput = {
      ...(input.run ? { experimentRun: { is: { id: input.run } } } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: "insensitive" } },
              { scenarioId: { contains: search, mode: "insensitive" } },
              { experimentRun: { is: { id: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.trialRecord.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        startedAt: true,
        triggerSource: true,
        scenarioId: true,
        recoveryMode: true,
        status: true,
        outcome: true,
        experimentRun: {
          select: {
            id: true,
            oracleSucceeded: true,
            status: true,
            manifest: { select: { configuration: true } },
            batch: { select: { configuration: true } },
          },
        },
      },
    });

    const page = rows.slice(0, input.limit);

    return {
      records: page.map((row) => ({
        id: row.id,
        runId: row.experimentRun?.id ?? null,
        startedAt: row.startedAt.toISOString(),
        trigger: row.triggerSource,
        scenario: row.scenarioId,
        strategy: strategyLabel(
          row.recoveryMode,
          row.experimentRun?.manifest?.configuration ?? row.experimentRun?.batch.configuration,
        ),
        status: row.status,
        outcome: row.outcome,
        oracle: oracleStatus(row.experimentRun),
      })),
      total: await this.prisma.trialRecord.count({ where }),
      nextCursor: rows.length > input.limit ? encodeCursor(page.at(-1)?.id) : null,
    };
  }

  async findTrialDetail(id: string) {
    const row = await this.prisma.trialRecord.findUnique({
      where: { id },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        triggerSource: true,
        scenarioId: true,
        recoveryMode: true,
        status: true,
        outcome: true,
        escalationReason: true,
        experimentRun: {
          select: {
            id: true,
            oracleSucceeded: true,
            status: true,
            timeToHealMs: true,
            timeToTerminationMs: true,
            faultToDetectionMs: true,
            manifest: { select: { restoration: true, configuration: true } },
            batch: { select: { configuration: true } },
          },
        },
        evidenceHistory: {
          select: {
            evidenceSnapshot: {
              select: { id: true, createdAt: true, overallState: true, summary: true },
            },
          },
          orderBy: { sequenceNumber: "asc" },
        },
        diagnosisResults: {
          select: { id: true, createdAt: true, incidentCode: true, reasoningSummary: true },
          orderBy: { createdAt: "asc" },
        },
        recoveryPlans: {
          select: {
            id: true,
            createdAt: true,
            rationale: true,
            expectedOutcome: true,
            escalationReason: true,
            actions: {
              select: { actionId: true, action: { select: { name: true } } },
              orderBy: [{ phase: "asc" }, { position: "asc" }],
            },
          },
          orderBy: { createdAt: "asc" },
        },
        recoveryDecisions: {
          select: {
            id: true,
            decidedAt: true,
            status: true,
            reason: true,
            escalationReason: true,
            recoveryPlanId: true,
          },
          orderBy: { sequenceNumber: "asc" },
        },
        actionExecutionResults: {
          select: {
            id: true,
            startedAt: true,
            status: true,
            safetyCheckStatus: true,
            failedSafetyRuleIds: true,
            beforeEvidenceSnapshotId: true,
            afterEvidenceSnapshotId: true,
            outcomeSummary: true,
            action: { select: { name: true } },
          },
          orderBy: { startedAt: "asc" },
        },
        evaluationSummary: {
          select: { id: true, createdAt: true, summary: true, safetyMaintained: true },
        },
        recoveryMeasurement: { select: { observedTimeToHealMs: true } },
      },
    });

    if (!row) {
      return null;
    }

    const trail = [
      ...row.evidenceHistory.map((link) => ({
        id: link.evidenceSnapshot.id,
        kind: "evidence" as const,
        label: "Evidence snapshot",
        summary: readable(link.evidenceSnapshot.summary),
        occurredAt: link.evidenceSnapshot.createdAt.toISOString(),
        status: link.evidenceSnapshot.overallState,
        detail: emptyDetail(),
      })),
      ...row.diagnosisResults.map((diagnosis) => ({
        id: diagnosis.id,
        kind: "diagnosis" as const,
        label: `Diagnosis: ${diagnosis.incidentCode}`,
        summary: readable(diagnosis.reasoningSummary),
        occurredAt: diagnosis.createdAt.toISOString(),
        status: "recorded",
        detail: emptyDetail(),
      })),
      ...row.recoveryPlans.map((plan) => ({
        id: plan.id,
        kind: "plan" as const,
        label: "Recovery plan",
        summary: readable(plan.rationale),
        occurredAt: plan.createdAt.toISOString(),
        status: plan.escalationReason ? "escalated" : "recorded",
        detail: { ...emptyDetail(), reason: readable(plan.expectedOutcome) },
      })),
      ...row.recoveryDecisions.map((decision) => ({
        id: decision.id,
        kind: "decision" as const,
        label: `Decision: ${decision.status}`,
        summary: readable(decision.reason),
        occurredAt: decision.decidedAt.toISOString(),
        status: decision.status,
        detail: {
          ...emptyDetail(),
          reason: decision.escalationReason ? readable(decision.escalationReason) : null,
          sourcePlanId: decision.recoveryPlanId,
        },
      })),
      ...row.actionExecutionResults.flatMap((action) => [
        {
          id: `${action.id}:safety`,
          kind: "safety" as const,
          label: `Safety: ${action.action.name}`,
          summary:
            action.safetyCheckStatus === "passed"
              ? "Registered safety checks passed."
              : "One or more registered safety checks did not pass.",
          occurredAt: action.startedAt.toISOString(),
          status: action.safetyCheckStatus,
          detail: { ...emptyDetail(), failedSafetyRuleIds: stringList(action.failedSafetyRuleIds) },
        },
        {
          id: action.id,
          kind: "action" as const,
          label: action.action.name,
          summary: action.outcomeSummary
            ? readable(action.outcomeSummary)
            : "No outcome summary was recorded.",
          occurredAt: action.startedAt.toISOString(),
          status: action.status,
          detail: {
            ...emptyDetail(),
            beforeEvidenceId: action.beforeEvidenceSnapshotId,
            afterEvidenceId: action.afterEvidenceSnapshotId,
          },
        },
      ]),
      ...(row.evaluationSummary
        ? [
            {
              id: row.evaluationSummary.id,
              kind: "evaluation" as const,
              label: "Evaluation",
              summary: readable(row.evaluationSummary.summary),
              occurredAt: row.evaluationSummary.createdAt.toISOString(),
              status: row.evaluationSummary.safetyMaintained
                ? "safety maintained"
                : "safety concern",
              detail: emptyDetail(),
            },
          ]
        : []),
    ].sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""));

    return {
      trial: {
        id: row.id,
        runId: row.experimentRun?.id ?? null,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        trigger: row.triggerSource,
        scenario: row.scenarioId,
        strategy: strategyLabel(
          row.recoveryMode,
          row.experimentRun?.manifest?.configuration ?? row.experimentRun?.batch.configuration,
        ),
        status: row.status,
        outcome: row.outcome,
        oracle: oracleStatus(row.experimentRun),
        reason: row.escalationReason ? readable(row.escalationReason) : null,
        restoration: restorationStatus(row.experimentRun?.manifest?.restoration),
      },
      trail,
      measurement: {
        observedTimeToHealMs: row.recoveryMeasurement?.observedTimeToHealMs ?? null,
        timeToHealMs: row.experimentRun?.timeToHealMs ?? null,
        timeToTerminationMs: row.experimentRun?.timeToTerminationMs ?? null,
        faultToDetectionMs: row.experimentRun?.faultToDetectionMs ?? null,
      },
    };
  }

  async listRecoveryCases() {
    const rows = await this.prisma.recoveryCase.findMany({
      take: 50,
      orderBy: [{ publishedAt: "desc" }, { sourcePlanId: "asc" }],
      select: {
        sourcePlanId: true,
        sourceTrialId: true,
        publishedAt: true,
        step: {
          select: {
            episode: { select: { compatibilityFingerprint: true, corpusSourceIds: true } },
            diagnosis: { select: { incidentCode: true } },
            planId: true,
          },
        },
      },
    });

    return Promise.all(rows.map((row) => this.findRecoveryCase(row.sourcePlanId))).then((entries) =>
      entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    );
  }

  async findRecoveryCase(sourcePlanId: string) {
    const row = await this.prisma.recoveryCase.findUnique({
      where: { sourcePlanId },
      select: {
        sourcePlanId: true,
        sourceTrialId: true,
        publishedAt: true,
        step: {
          select: {
            episode: { select: { compatibilityFingerprint: true, corpusSourceIds: true } },
            diagnosis: { select: { incidentCode: true } },
            planId: true,
          },
        },
      },
    });

    if (!row?.step.planId) {
      return null;
    }

    const plan = await this.prisma.recoveryPlan.findUnique({
      where: { id: row.step.planId },
      select: {
        rationale: true,
        expectedOutcome: true,
        actions: { select: { actionId: true }, orderBy: [{ phase: "asc" }, { position: "asc" }] },
        trial: { select: { experimentRun: { select: { oracleSucceeded: true } } } },
      },
    });

    if (!plan) {
      return null;
    }

    return {
      sourcePlanId: row.sourcePlanId,
      sourceTrialId: row.sourceTrialId,
      publishedAt: row.publishedAt.toISOString(),
      incident: row.step.diagnosis.incidentCode,
      rationale: readable(plan.rationale),
      expectedOutcome: readable(plan.expectedOutcome),
      actions: plan.actions.map((action) => action.actionId),
      compatibilityFingerprint: row.step.episode.compatibilityFingerprint,
      corpusSourceIds: stringList(row.step.episode.corpusSourceIds),
      oracle: plan.trial.experimentRun?.oracleSucceeded ? "passed" : "unavailable",
    };
  }

  async listExperiments() {
    const batches = await this.prisma.experimentBatch.findMany({
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        sourceRevision: true,
        measurementVersion: true,
        createdAt: true,
        completedAt: true,
        requestedRepetitions: true,
        _count: { select: { runs: true } },
        runs: { select: { valid: true } },
      },
    });

    return batches.map((batch) => ({
      id: batch.id,
      name: readable(batch.name),
      status: batch.status,
      sourceRevision: batch.sourceRevision,
      measurementVersion: batch.measurementVersion,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() ?? null,
      requestedRepetitions: batch.requestedRepetitions,
      validRuns: batch.runs.some((run) => run.valid !== null)
        ? batch.runs.filter((run) => run.valid).length
        : null,
      attemptedRuns: batch._count.runs,
    }));
  }

  async findExperiment(id: string) {
    const batch = await this.prisma.experimentBatch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        sourceRevision: true,
        measurementVersion: true,
        createdAt: true,
        completedAt: true,
        requestedRepetitions: true,
        configuration: true,
        runs: {
          orderBy: [{ startedAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            trialRecordId: true,
            faultProfile: true,
            recoveryMode: true,
            repetition: true,
            status: true,
            valid: true,
            exclusionReason: true,
            runtimeResolved: true,
            oracleSucceeded: true,
            timeToHealMs: true,
          },
        },
      },
    });

    if (!batch) {
      return null;
    }

    const validRuns = batch.runs.some((run) => run.valid !== null)
      ? batch.runs.filter((run) => run.valid).length
      : null;

    return {
      id: batch.id,
      name: readable(batch.name),
      status: batch.status,
      sourceRevision: batch.sourceRevision,
      measurementVersion: batch.measurementVersion,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() ?? null,
      requestedRepetitions: batch.requestedRepetitions,
      validRuns,
      attemptedRuns: batch.runs.length,
      configuration: sanitizeJson(batch.configuration),
      runs: batch.runs.map((run) => ({
        id: run.id,
        trialId: run.trialRecordId,
        profile: run.faultProfile,
        strategy: run.recoveryMode,
        repetition: run.repetition,
        status: run.status,
        valid: run.valid,
        exclusionReason: run.exclusionReason ? readable(run.exclusionReason) : null,
        runtimeResolved: run.runtimeResolved,
        oracle:
          run.oracleSucceeded === true
            ? "passed"
            : run.oracleSucceeded === false
              ? "failed"
              : run.status === "completed" || run.status === "invalid"
                ? "unavailable"
                : "pending",
        timeToHealMs: run.timeToHealMs,
      })),
    };
  }

  async readActiveRun() {
    return this.prisma.experimentRun.findUnique({
      where: { activeLockKey: "global" },
      select: { id: true, status: true },
    });
  }

  async findAcceptedOperatorRequest(input: ControlledTestRequest) {
    const run = await this.prisma.experimentRun.findUnique({
      where: { id: `operator-run-${input.requestId}` },
      select: { id: true, faultProfile: true, manifest: { select: { configuration: true } } },
    });

    if (!run) {
      return null;
    }

    const configuration = run.manifest?.configuration as Record<string, unknown> | undefined;

    if (
      run.faultProfile !== input.profile ||
      configuration?.requestedStrategy !== input.strategy ||
      configuration?.requestedWorkload !== input.workload
    ) {
      throw new Error("This request ID belongs to a different controlled test.");
    }

    return { requestId: input.requestId, runId: run.id, accepted: true };
  }

  readControlledTestRun(id: string) {
    return this.prisma.experimentRun.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        trialRecordId: true,
        exclusionReason: true,
        activeLockKey: true,
        manifest: { select: { restoration: true } },
      },
    });
  }

  async createOrReadOperatorRun(input: {
    requestId: string;
    profile: FaultProfileCode;
    recoveryMode: "baseline" | "agent";
    configuration: Prisma.InputJsonValue;
    stabilityWindowMs: number;
    sourceRevision: string;
  }) {
    const runId = `operator-run-${input.requestId}`;

    const batchId = `operator-batch-${input.requestId}`;

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.experimentRun.findUnique({ where: { id: runId } });

        if (existing) {
          return { run: existing, created: false };
        }

        await transaction.experimentBatch.upsert({
          where: { id: batchId },
          create: {
            id: batchId,
            name: "Operator controlled test",
            status: "active",
            sourceRevision: input.sourceRevision,
            measurementVersion: "2.0.0",
            configuration: input.configuration,
            requestedRepetitions: 1,
            runOrderSeed: input.requestId,
            createdAt: new Date(),
          },
          update: {},
        });
        const run = await transaction.experimentRun.create({
          data: {
            id: runId,
            batchId,
            faultProfile: input.profile,
            recoveryMode: input.recoveryMode,
            repetition: 1,
            status: "prepared",
            activeLockKey: "global",
            startedAt: new Date(),
            stabilityWindowMs: input.stabilityWindowMs,
          },
        });

        await transaction.experimentRunManifest.create({
          data: { runId, configuration: input.configuration },
        });

        return { run, created: true };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const existing = await this.prisma.experimentRun.findUnique({ where: { id: runId } });

      if (existing) {
        return { run: existing, created: false };
      }

      throw new Error("Another controlled experiment run is already active.");
    }
  }

  async updateRunRestoration(runId: string, restoration: Prisma.InputJsonValue) {
    return this.prisma.experimentRunManifest.update({ where: { runId }, data: { restoration } });
  }

  async releaseOperatorRunLock(runId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.experimentRun.update({
        where: { id: runId },
        data: { activeLockKey: null },
      });
      await transaction.experimentBatch.updateMany({
        where: { id: { startsWith: "operator-batch-" }, runs: { some: { id: runId } } },
        data: { status: "completed", completedAt: new Date() },
      });
    });
  }

  async cancelPreparedOperatorRun(runId: string, reason: string) {
    return this.prisma.$transaction(async (transaction) => {
      const run = await transaction.experimentRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });

      if (!run || run.status !== "prepared") {
        return;
      }

      await transaction.experimentRun.update({
        where: { id: runId },
        data: {
          status: "invalid",
          valid: false,
          exclusionReason: reason,
          completedAt: new Date(),
          activeLockKey: null,
        },
      });
      await transaction.experimentBatch.updateMany({
        where: { id: { startsWith: "operator-batch-" }, runs: { some: { id: runId } } },
        data: { status: "failed", completedAt: new Date() },
      });
    });
  }
}

function strategyLabel(mode: string, configuration: unknown): string {
  if (mode === "baseline") {return "Baseline";}

  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration))
    {return "Agent (version not recorded)";}

  const metadata = configuration as Record<string, unknown>;

  const version = metadata.expectedAgentStrategyVersion ?? metadata.agentStrategyVersion;

  if (version === "v1") {return "Agent V1";}

  if (version === "v2")
    {return `Agent V2${metadata.retrievalEnabled === true ? " (reuse enabled)" : ""}`;}

  return "Agent (version not recorded)";
}

function emptyDetail() {
  return {
    reason: null,
    beforeEvidenceId: null,
    afterEvidenceId: null,
    failedSafetyRuleIds: [],
    sourcePlanId: null,
    sourceTrialId: null,
  };
}

function readable(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxReadableText);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 20)
    : [];
}

function oracleStatus(run: { oracleSucceeded: boolean | null; status: string } | null | undefined) {
  if (!run) {
    return "not_performed" as const;
  }

  if (run.oracleSucceeded === true) {
    return "passed" as const;
  }

  if (run.oracleSucceeded === false) {
    return "failed" as const;
  }

  return run.status === "prepared" ||
    run.status === "fault_injected" ||
    run.status === "trial_linked"
    ? ("pending" as const)
    : ("unavailable" as const);
}

function restorationStatus(value: unknown) {
  if (!value || typeof value !== "object") {
    return "not_recorded" as const;
  }

  const status = (value as { status?: unknown }).status;

  return status === "verified"
    ? ("verified" as const)
    : status === "failed"
      ? ("failed" as const)
      : status === "captured"
        ? ("pending" as const)
        : ("not_recorded" as const);
}

function sanitizeJson(value: unknown, depth = 0): Record<string, unknown> {
  if (depth > 4 || value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (secretKey.test(key)) {
        return [];
      }

      if (entry === null || ["string", "number", "boolean"].includes(typeof entry)) {
        return [[key, entry]];
      }

      if (Array.isArray(entry)) {
        return [[key, `Recorded list (${entry.length})`]];
      }

      return [[key, sanitizeJson(entry, depth + 1)]];
    }),
  );
}

function encodeCursor(id: string | undefined): string | null {
  return id ? Buffer.from(id).toString("base64url") : null;
}

function decodeCursor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const id = Buffer.from(value, "base64url").toString("utf8");

    return /^[a-zA-Z0-9_.:-]+$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}
