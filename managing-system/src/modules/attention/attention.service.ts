import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { getDeterministicEvidenceState, type EvidenceSnapshot } from "@/modules/evidence";
import {
  recoveryEvidenceSignature,
  fingerprintRecoveryConfiguration,
  type RecoveryDecision,
} from "@/modules/recovery";
import type { AttentionRepository, RecoveryAttention } from "./attention.repository";

export class AttentionService {
  constructor(private readonly repository: AttentionRepository) {}

  async recordEscalation(input: {
    trialRecordId: string;
    initialSnapshot: EvidenceSnapshot;
    latestSnapshot: EvidenceSnapshot;
    decision?: RecoveryDecision;
    reason: string;
  }): Promise<RecoveryAttention> {
    return this.repository.createAttention({
      id: `attention-${randomUUID()}`,
      trialRecordId: input.trialRecordId,
      signature: this.signature(input.latestSnapshot),
      initialEvidenceSnapshotId: input.initialSnapshot.id,
      latestEvidenceSnapshotId: input.latestSnapshot.id,
      diagnosisResultId: input.decision?.diagnosisResult.id ?? null,
      decisionId: input.decision?.id ?? null,
      reason: input.reason,
      createdAt: new Date(),
    });
  }

  async observeEvidence(snapshot: EvidenceSnapshot): Promise<boolean> {
    return this.repository.observeIncident(
      this.signature(snapshot),
      snapshot.id,
      getDeterministicEvidenceState(snapshot) === "healthy",
    );
  }

  async listAttention(limit = 50): Promise<RecoveryAttention[]> {
    return this.repository.listAttention(z.number().int().min(1).max(100).parse(limit));
  }

  async readAttention(id: string): Promise<RecoveryAttention> {
    return this.repository.readAttention(z.string().min(1).max(100).parse(id));
  }

  async acknowledgeAttention(id: string): Promise<RecoveryAttention> {
    return this.repository.transitionAttention(
      z.string().min(1).max(100).parse(id),
      "requires_attention",
      "acknowledged",
    );
  }

  async reviewAttention(id: string, notes: string): Promise<RecoveryAttention> {
    return this.repository.transitionAttention(
      z.string().min(1).max(100).parse(id),
      "acknowledged",
      "reviewed",
      z.string().trim().min(1).max(4000).parse(notes),
    );
  }

  private signature(snapshot: EvidenceSnapshot): string {
    return (
      recoveryEvidenceSignature(snapshot) ??
      fingerprintRecoveryConfiguration({
        target: snapshot.targetSystem,
        incomplete: snapshot.signals
          .filter((signal) => signal.method === "deterministic")
          .map((signal) => ({ code: signal.code, status: signal.status }))
          .sort((a, b) => a.code.localeCompare(b.code)),
      })
    );
  }
}
