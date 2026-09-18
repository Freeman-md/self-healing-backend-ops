import { z } from "zod";

const isoDate = z.string().datetime();

const signalSchema = z.object({
  code: z.string(),
  label: z.string(),
  status: z.enum([
    "healthy",
    "degraded",
    "unhealthy",
    "unknown",
    "unavailable",
  ]),
  value: z.string().nullable(),
  description: z.string(),
});

export const strategySchema = z.object({
  id: z.enum(["baseline", "v1", "v2", "v2-reuse"]),
  label: z.string(),
  reuseEnabled: z.boolean(),
  maxActions: z.number().int().positive(),
  maxTurns: z.number().int().positive(),
  ready: z.boolean(),
  reason: z.string().nullable(),
});

export const operatorStateSchema = z.object({
  serverTime: isoDate,
  controlPlane: z.object({
    status: z.enum(["available", "unavailable"]),
    message: z.string().nullable(),
  }),
  evidence: z
    .object({
      id: z.string(),
      observedAt: isoDate,
      freshness: z.enum(["fresh", "stale", "unknown"]),
      overallState: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
      summary: z.string(),
      signals: z.array(signalSchema),
      contradictions: z.array(z.string()),
    })
    .nullable(),
  monitor: z.object({
    state: z.enum([
      "observing",
      "recovering",
      "cooldown",
      "held",
      "stopped",
      "unavailable",
    ]),
    heartbeatAt: isoDate.nullable(),
    activeRunId: z.string().nullable(),
    strategy: strategySchema.nullable(),
    readiness: z.object({
      canLaunch: z.boolean(),
      reasons: z.array(z.string()),
    }),
  }),
  strategies: z.array(strategySchema),
  workloads: z.array(
    z.object({
      id: z.literal("idle"),
      label: z.string(),
      ready: z.boolean(),
      reason: z.string().nullable(),
    }),
  ),
});

const trialSummarySchema = z.object({
  id: z.string(),
  runId: z.string().nullable(),
  startedAt: isoDate,
  trigger: z.enum(["controlled", "monitor"]),
  scenario: z.string().nullable(),
  strategy: z.string(),
  status: z.string(),
  outcome: z.string(),
  oracle: z.enum([
    "passed",
    "failed",
    "pending",
    "not_performed",
    "unavailable",
  ]),
});

export const trialPageSchema = z.object({
  records: z.array(trialSummarySchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});

export const trialDetailSchema = z.object({
  trial: trialSummarySchema.extend({
    completedAt: isoDate.nullable(),
    reason: z.string().nullable(),
    restoration: z.enum(["verified", "failed", "pending", "not_recorded"]),
  }),
  trail: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        "evidence",
        "diagnosis",
        "plan",
        "decision",
        "safety",
        "action",
        "evaluation",
      ]),
      label: z.string(),
      summary: z.string(),
      occurredAt: isoDate.nullable(),
      status: z.string(),
      detail: z.object({
        reason: z.string().nullable(),
        beforeEvidenceId: z.string().nullable(),
        afterEvidenceId: z.string().nullable(),
        failedSafetyRuleIds: z.array(z.string()),
        planOrigin: z.enum(["generated", "retrieved"]).nullable().default(null),
        sourcePlanId: z.string().nullable(),
        sourceTrialId: z.string().nullable(),
      }),
    }),
  ),
  measurement: z.object({
    observedTimeToHealMs: z.number().nullable(),
    timeToHealMs: z.number().nullable(),
    timeToTerminationMs: z.number().nullable(),
    faultToDetectionMs: z.number().nullable(),
  }),
});

export const attentionSchema = z.object({
  id: z.string(),
  trialId: z.string(),
  reason: z.string(),
  state: z.enum(["requires_attention", "acknowledged", "reviewed"]),
  createdAt: isoDate,
  acknowledgedAt: isoDate.nullable(),
  reviewedAt: isoDate.nullable(),
  notes: z.string().nullable(),
  releasedAt: isoDate.nullable(),
  latestEvidenceId: z.string(),
});

export const attentionDetailSchema = attentionSchema.extend({
  initialEvidenceId: z.string(),
  healthyEvidenceId: z.string().nullable(),
  currentHealth: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
  trialOutcome: z.string(),
});

export const recoveryCaseSchema = z.object({
  sourcePlanId: z.string(),
  sourceTrialId: z.string(),
  publishedAt: isoDate,
  incident: z.string(),
  rationale: z.string(),
  expectedOutcome: z.string(),
  actions: z.array(z.string()),
  compatibilityFingerprint: z.string(),
  corpusSourceIds: z.array(z.string()),
  oracle: z.enum(["passed", "unavailable"]),
});

export const experimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  sourceRevision: z.string(),
  measurementVersion: z.string(),
  createdAt: isoDate,
  completedAt: isoDate.nullable(),
  requestedRepetitions: z.number().int(),
  validRuns: z.number().int().nullable(),
  attemptedRuns: z.number().int(),
});

export const experimentDetailSchema = experimentSchema.extend({
  configuration: z.record(z.string(), z.unknown()),
  runs: z.array(
    z.object({
      id: z.string(),
      trialId: z.string().nullable(),
      profile: z.string(),
      strategy: z.string(),
      repetition: z.number().int(),
      status: z.string(),
      valid: z.boolean().nullable(),
      exclusionReason: z.string().nullable(),
      runtimeResolved: z.boolean().nullable(),
      oracle: z.enum(["passed", "failed", "pending", "unavailable"]),
      timeToHealMs: z.number().nullable(),
    }),
  ),
});

export const launchResponseSchema = z.object({
  requestId: z.string(),
  runId: z.string(),
  accepted: z.boolean(),
});

const controlledRunSchema = z.object({
  id: z.string(),
  status: z.string(),
  trialId: z.string().nullable(),
  lockHeld: z.boolean(),
  restoration: z.enum(["verified", "failed", "pending"]),
  failed: z.boolean(),
});

export type OperatorState = z.infer<typeof operatorStateSchema>;
export type TrialSummary = z.infer<typeof trialSummarySchema>;
export type TrialDetail = z.infer<typeof trialDetailSchema>;
export type Attention = z.infer<typeof attentionSchema>;
export type AttentionDetail = z.infer<typeof attentionDetailSchema>;
export type RecoveryCase = z.infer<typeof recoveryCaseSchema>;
export type Experiment = z.infer<typeof experimentSchema>;
export type ExperimentDetail = z.infer<typeof experimentDetailSchema>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId: string | null,
  ) {
    super(message);
  }
}

async function request<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const mutation = Boolean(init.method && init.method !== "GET");
  const timeout = AbortSignal.timeout(mutation ? 15_000 : 5_000);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: {
        Accept: "application/json",
        ...(mutation ? { "X-Operator-Request": "1" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      mutation
        ? "Request acceptance could not be confirmed. Refresh current state before retrying. Your draft is preserved."
        : "The local control plane could not be reached. Check that it is running, then retry the read.",
      0,
      null,
    );
  }
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = z
      .object({
        error: z.object({
          message: z.string(),
          correlationId: z.string().nullable(),
        }),
      })
      .safeParse(body);
    throw new ApiError(
      parsedError.success
        ? parsedError.data.error.message
        : "The control plane did not return a usable response.",
      response.status,
      parsedError.success ? parsedError.data.error.correlationId : null,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      mutation
        ? "Request acceptance could not be confirmed. Refresh current state before retrying. Your draft is preserved."
        : "The control plane returned unusable information. Refresh the read; do not rely on the previous observation.",
      response.status,
      null,
    );
  }
  return parsed.data;
}

export const api = {
  getControlledRun: (id: string, signal?: AbortSignal) =>
    request(
      `/api/controlled-tests/${encodeURIComponent(id)}`,
      controlledRunSchema,
      {},
      signal,
    ),
  getState: (signal?: AbortSignal) =>
    request("/api/operator/state", operatorStateSchema, {}, signal),
  listTrials: (query: URLSearchParams, signal?: AbortSignal) =>
    request(`/api/trials?${query.toString()}`, trialPageSchema, {}, signal),
  getTrial: (id: string, signal?: AbortSignal) =>
    request(
      `/api/trials/${encodeURIComponent(id)}`,
      trialDetailSchema,
      {},
      signal,
    ),
  listAttention: (signal?: AbortSignal) =>
    request("/api/attention", z.array(attentionSchema), {}, signal),
  getAttention: (id: string, signal?: AbortSignal) =>
    request(
      `/api/attention/${encodeURIComponent(id)}`,
      attentionDetailSchema,
      {},
      signal,
    ),
  acknowledgeAttention: (id: string) =>
    request(
      `/api/attention/${encodeURIComponent(id)}/acknowledge`,
      attentionDetailSchema,
      { method: "POST" },
    ),
  reviewAttention: (id: string, notes: string) =>
    request(
      `/api/attention/${encodeURIComponent(id)}/review`,
      attentionDetailSchema,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      },
    ),
  listRecoveryCases: (signal?: AbortSignal) =>
    request("/api/recovery-cases", z.array(recoveryCaseSchema), {}, signal),
  getRecoveryCase: (planId: string, signal?: AbortSignal) =>
    request(
      `/api/recovery-cases/${encodeURIComponent(planId)}`,
      recoveryCaseSchema,
      {},
      signal,
    ),
  listExperiments: (signal?: AbortSignal) =>
    request("/api/experiments", z.array(experimentSchema), {}, signal),
  getExperiment: (id: string, signal?: AbortSignal) =>
    request(
      `/api/experiments/${encodeURIComponent(id)}`,
      experimentDetailSchema,
      {},
      signal,
    ),
  launchControlledTest: (input: {
    requestId: string;
    profile: string;
    strategy: string;
    workload: "idle";
  }) =>
    request("/api/controlled-tests", launchResponseSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
};
