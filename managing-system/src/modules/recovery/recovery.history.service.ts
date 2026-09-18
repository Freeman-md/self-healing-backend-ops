import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { RecoveryFactory } from "./recovery.factory";
import type { RecoveryService } from "./recovery.service";
import type { RecoveryHistoryRepository } from "./recovery.history.repository";
import type { ControlledRecoveryEnvironment } from "./recovery.types";
import type { DiagnosisResult, RecoveryDecision } from "./recovery.schema";
import { agentV2DecisionSchema } from "./strategies/agent-v2/recovery.agent-v2.schema";
import { validateDecision } from "./strategies/agent-v2/recovery.agent-v2.validation";
import { recoveryEvidenceSignature } from "./recovery.history.helpers";

export const historicalDiagnosisSchema = agentV2DecisionSchema.shape.diagnosisResult.extend({
  suspectedIncidentType: z.string().min(1).max(100),
  reasoningSummary: z.string().min(1).max(2000),
  supportingSignals: z.array(z.string().max(100)).max(20),
  contradictions: z.array(z.string().max(500)).max(20),
});
export const historicalGenerationSchema = agentV2DecisionSchema
  .omit({ diagnosisResult: true })
  .extend({
    reason: z.string().min(1).max(2000),
    recoveryPlan: agentV2DecisionSchema.shape.recoveryPlan.extend({
      proposedActionIds: z.array(z.string().max(100)).max(3),
      fallbackActionIds: z.array(z.string().max(100)).max(3),
      rationale: z.string().max(2000),
      expectedOutcome: z.string().max(2000),
      escalationReason: z.string().max(2000).nullable(),
    }),
  });
export const historicalAdoptionSchema = z.strictObject({
  candidateReference: z.string().min(1).max(100),
  status: z.literal("action_selected"),
  reason: z.string().min(1).max(2000),
});
export const sourceTrialIdsSchema = z
  .array(z.string().min(1).max(100))
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length);
export type HistoricalToolResult = {
  accepted: boolean;
  error?: string;
  decision?: RecoveryDecision;
  observation?: unknown;
};
export interface HistoricalRecoveryOperations {
  diagnoseAndLookup(input: unknown): Promise<HistoricalToolResult>;
  generatePlan(input: unknown): Promise<HistoricalToolResult>;
  adoptPlan(input: unknown): Promise<HistoricalToolResult>;
  invalidate(): void;
}

export class RecoveryHistoryService {
  constructor(
    readonly repository: RecoveryHistoryRepository,
    private readonly recovery: Pick<RecoveryService, "recordStandaloneDiagnosis">,
    private readonly factory = new RecoveryFactory(),
    private readonly settings?: {
      enabled: boolean;
      sourceIds: string[];
      fingerprint: () => Promise<string>;
      recoveryMode?: string;
      agentStrategyVersion?: string;
    },
  ) {}

  async beginTrial(
    trialRecordId: string,
    triggerSource: "controlled" | "monitor",
  ): Promise<{ enabled: boolean; sourceIds: string[]; fingerprint: string }> {
    if (!this.settings) {
      throw new Error("Recovery history settings are required.");
    }

    const active = await this.repository.findActiveExperiment();

    const manifest = active?.manifest
      ? z
          .object({
            retrievalEnabled: z.boolean(),
            sourceTrialIds: sourceTrialIdsSchema,
            expectedRecoveryMode: z.string(),
            expectedAgentStrategyVersion: z.string(),
            compatibilityFingerprint: z.string(),
          })
          .parse(active.manifest.configuration)
      : undefined;

    const settings = {
      enabled: manifest?.retrievalEnabled ?? this.settings.enabled,
      sourceIds: sourceTrialIdsSchema.parse(manifest?.sourceTrialIds ?? this.settings.sourceIds),
      fingerprint: await this.settings.fingerprint(),
    };

    if (
      manifest &&
      (manifest.expectedRecoveryMode !== this.settings.recoveryMode ||
        manifest.expectedAgentStrategyVersion !== this.settings.agentStrategyVersion ||
        manifest.compatibilityFingerprint !== settings.fingerprint)
    ) {
      throw new Error("Monitor identity/configuration differs from the frozen run manifest.");
    }

    await this.repository.createEpisode({
      trialRecordId,
      origin: active
        ? manifest
          ? "experiment"
          : "unknown"
        : triggerSource === "monitor"
          ? "normal"
          : "unknown",
      experimentRunId: active?.id ?? null,
      compatibilityFingerprint: settings.fingerprint,
      corpusSourceIds: settings.sourceIds,
      retrievalEnabled: settings.enabled,
    });

    return settings;
  }

  createControlledOperations(input: {
    environment: ControlledRecoveryEnvironment;
    currentSnapshot: () => EvidenceSnapshot;
    fingerprint: string;
    sourceIds: string[];
  }): HistoricalRecoveryOperations {
    const sourceIds = sourceTrialIdsSchema.parse(input.sourceIds);

    const { environment } = input;

    let diagnosis: DiagnosisResult | undefined;

    let candidate:
      | { reference: string; sourceTrialId: string; sourcePlanId: string; signature: string }
      | undefined;

    let consumed = false;

    const reject = (error: string): HistoricalToolResult => ({ accepted: false, error });

    const persist = async (
      semantic: z.infer<typeof historicalGenerationSchema>,
      source?: { sourceTrialId: string; sourcePlanId: string },
    ): Promise<HistoricalToolResult> => {
      const snapshot = input.currentSnapshot();

      if (!diagnosis || consumed || diagnosis.evidenceSnapshotId !== snapshot.id) {
        return reject("Diagnose current evidence before recording a plan.");
      }

      const error = validateDecision(
        { ...semantic, diagnosisResult: diagnosis },
        snapshot,
        environment,
        "record_recovery_decision",
      );

      if (error) {
        return reject(error);
      }

      const plan = this.factory.createRecoveryPlan({
        ...semantic.recoveryPlan,
        diagnosisResultId: diagnosis.id,
      });

      const decision = this.factory.createRecoveryDecision({
        mode: "agent",
        snapshot,
        diagnosisResult: diagnosis,
        recoveryPlan: plan,
        status: semantic.status,
        reason: semantic.reason,
        escalationReason: semantic.escalationReason ?? undefined,
      });

      const recorded = await environment.recordDecision(decision);

      await this.repository.recordPlan(
        environment.trialRecordId,
        recorded,
        recoveryEvidenceSignature(snapshot, diagnosis.suspectedIncidentType),
        source,
      );
      consumed = true;
      candidate = undefined;

      return {
        accepted: true,
        decision: recorded,
        observation: {
          accepted: true,
          planOrigin: source ? "retrieved" : "generated",
          acceptedActionIds: [...plan.proposedActionIds, ...plan.fallbackActionIds],
        },
      };
    };

    return {
      invalidate: () => {
        diagnosis = undefined;
        candidate = undefined;
        consumed = false;
      },
      diagnoseAndLookup: async (value) => {
        const parsed = historicalDiagnosisSchema.safeParse(value);

        if (!parsed.success) {
          return reject("Invalid strict semantic diagnosis.");
        }

        const snapshot = input.currentSnapshot();

        const semantic = parsed.data;

        if (
          semantic.supportingSignals.some(
            (name) =>
              name === "[redacted]" ||
              !snapshot.signals.some(
                (signal) => signal.name === name && signal.name === signal.code,
              ),
          ) ||
          new Set(semantic.supportingSignals).size !== semantic.supportingSignals.length ||
          new Set(semantic.contradictions).size !== semantic.contradictions.length
        ) {
          return reject("Diagnosis references must be unique current signal names.");
        }

        candidate = undefined;
        consumed = false;
        diagnosis = await this.recovery.recordStandaloneDiagnosis(
          environment.trialRecordId,
          this.factory.createDiagnosisResult({
            ...semantic,
            method: "llm",
            sourceIds: [],
            evidenceSnapshotId: snapshot.id,
          }),
        );
        const diagnosisReadyAt = new Date();

        const signature = recoveryEvidenceSignature(snapshot, semantic.suspectedIncidentType);

        await this.repository.recordDiagnosis({
          trialRecordId: environment.trialRecordId,
          diagnosisResultId: diagnosis.id,
          signature,
          diagnosisReadyAt,
        });
        const lookupStartedAt = new Date();

        const found = signature
          ? await this.repository.findCandidate({
              currentTrialId: environment.trialRecordId,
              sourceIds,
              signature,
              fingerprint: input.fingerprint,
            })
          : null;

        const lookupCompletedAt = new Date();

        const outcome = found
          ? "candidate"
          : signature
            ? "no_eligible_source"
            : "insufficient_deterministic_state";

        await this.repository.recordLookup(diagnosis.id, {
          lookupStartedAt,
          lookupCompletedAt,
          lookupOutcome: outcome,
        });
        if (found && signature) {
          candidate = {
            reference: randomUUID(),
            sourceTrialId: found.sourceTrialId,
            sourcePlanId: found.sourcePlanId,
            signature,
          };
        }

        return {
          accepted: true,
          observation: {
            accepted: true,
            outcome,
            latencyMs: lookupCompletedAt.getTime() - lookupStartedAt.getTime(),
            candidate:
              found && candidate
                ? {
                    reference: candidate.reference,
                    plan: agentV2DecisionSchema.shape.recoveryPlan.parse({
                      proposedActionIds: found.decision.recoveryPlan.proposedActionIds,
                      fallbackActionIds: found.decision.recoveryPlan.fallbackActionIds,
                      rationale: found.decision.recoveryPlan.rationale,
                      expectedOutcome: found.decision.recoveryPlan.expectedOutcome,
                      escalationReason: found.decision.recoveryPlan.escalationReason,
                    }),
                  }
                : null,
          },
        };
      },
      generatePlan: async (value) => {
        const parsed = historicalGenerationSchema.safeParse(value);

        return parsed.success
          ? persist(parsed.data)
          : reject("Invalid strict semantic plan/decision.");
      },
      adoptPlan: async (value) => {
        const parsed = historicalAdoptionSchema.safeParse(value);

        if (
          !parsed.success ||
          !candidate ||
          parsed.data.candidateReference !== candidate.reference ||
          !diagnosis ||
          consumed ||
          diagnosis.evidenceSnapshotId !== input.currentSnapshot().id ||
          recoveryEvidenceSignature(input.currentSnapshot(), diagnosis.suspectedIncidentType) !==
            candidate.signature
        ) {
          return reject("Candidate is stale or foreign; diagnose current evidence again.");
        }

        const source = await this.repository.validateEligiblePlan(
          candidate.sourceTrialId,
          candidate.sourcePlanId,
          candidate.signature,
          input.fingerprint,
        );

        if (!source || !sourceIds.includes(candidate.sourceTrialId)) {
          return reject("Candidate is no longer eligible.");
        }

        const plan = {
          proposedActionIds: source.recoveryPlan.proposedActionIds,
          fallbackActionIds: source.recoveryPlan.fallbackActionIds,
          rationale: source.recoveryPlan.rationale,
          expectedOutcome: source.recoveryPlan.expectedOutcome,
          escalationReason: source.recoveryPlan.escalationReason,
        };

        return persist(
          {
            status: parsed.data.status,
            reason: parsed.data.reason,
            recoveryPlan: plan,
            escalationReason: null,
          },
          candidate,
        );
      },
    };
  }
}
