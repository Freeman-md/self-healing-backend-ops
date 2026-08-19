import { Prisma } from "@/generated/prisma/client";
import { PrismaService } from "@/infrastructure/database";

import {
  evidenceSnapshotSchema,
  rawEvidenceSchema,
  type EvidenceSnapshot,
  type RawEvidence,
  type RawEvidenceSource,
} from "./evidence.schema";

export class EvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveRawEvidence(rawEvidence: RawEvidence): Promise<RawEvidence> {
    const parsed = rawEvidenceSchema.parse(rawEvidence);

    await this.prisma.rawEvidence.upsert({
      where: { id: parsed.id },
      create: { id: parsed.id, ...toRawEvidenceData(parsed) },
      update: toRawEvidenceData(parsed),
    });

    return parsed;
  }

  async saveEvidenceSnapshot(snapshot: EvidenceSnapshot): Promise<EvidenceSnapshot> {
    const parsed = evidenceSnapshotSchema.parse(snapshot);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.evidenceSnapshot.upsert({
        where: { id: parsed.id },
        create: {
          id: parsed.id,
          createdAt: new Date(parsed.createdAt),
          targetSystem: parsed.targetSystem,
          overallState: parsed.overallState,
          summary: parsed.summary,
          contradictions: parsed.contradictions,
          legacyPayload: null,
        },
        update: {
          createdAt: new Date(parsed.createdAt),
          targetSystem: parsed.targetSystem,
          overallState: parsed.overallState,
          summary: parsed.summary,
          contradictions: parsed.contradictions,
        },
      });

      await transaction.evidenceSignal.deleteMany({
        where: { snapshotId: parsed.id },
      });
      await transaction.evidenceIncident.deleteMany({
        where: { snapshotId: parsed.id },
      });

      if (parsed.signals.length > 0) {
        await transaction.evidenceSignal.createMany({
          data: parsed.signals.map((signal, position) => ({
            id: `${parsed.id}-signal-${position}`,
            snapshotId: parsed.id,
            source: toPersistedSource(signal.source),
            code: signal.code,
            name: signal.name,
            status: signal.status,
            value: signal.value ?? Prisma.JsonNull,
            description: signal.description,
            method: signal.method,
            position,
          })),
        });
      }

      if (parsed.suspectedIncidentTypes.length > 0) {
        await transaction.evidenceIncident.createMany({
          data: parsed.suspectedIncidentTypes.map((incidentCode, position) => ({
            id: `${parsed.id}-incident-${position}`,
            snapshotId: parsed.id,
            incidentCode,
            position,
          })),
        });
      }

      await transaction.rawEvidence.updateMany({
        where: {
          snapshotId: parsed.id,
          ...(parsed.rawEvidenceIds.length > 0 ? { id: { notIn: parsed.rawEvidenceIds } } : {}),
        },
        data: { snapshotId: null },
      });
      await transaction.rawEvidence.updateMany({
        where: { id: { in: parsed.rawEvidenceIds } },
        data: { snapshotId: parsed.id },
      });
    });

    return parsed;
  }

  async findEvidenceSnapshotById(snapshotId: string): Promise<EvidenceSnapshot | null> {
    const row = await this.prisma.evidenceSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        createdAt: true,
        targetSystem: true,
        overallState: true,
        summary: true,
        contradictions: true,
        rawEvidence: {
          select: { id: true },
          orderBy: { collectedAt: "asc" },
        },
        signals: {
          select: {
            source: true,
            name: true,
            code: true,
            status: true,
            value: true,
            description: true,
            method: true,
          },
          orderBy: { position: "asc" },
        },
        incidents: {
          select: { incidentCode: true },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!row) {
      return null;
    }

    return evidenceSnapshotSchema.parse({
      id: row.id,
      rawEvidenceIds: row.rawEvidence.map((evidence) => evidence.id),
      createdAt: row.createdAt.toISOString(),
      targetSystem: row.targetSystem,
      overallState: row.overallState,
      summary: row.summary,
      signals: row.signals.map((signal) => ({
        ...signal,
        source: fromPersistedSource(signal.source),
        value: signal.value,
      })),
      suspectedIncidentTypes: row.incidents.map((incident) => incident.incidentCode),
      contradictions: row.contradictions,
    });
  }
}

function toRawEvidenceData(rawEvidence: RawEvidence) {
  return {
    source: toPersistedSource(rawEvidence.source),
    target: rawEvidence.target,
    collectedAt: new Date(rawEvidence.collectedAt),
    status: rawEvidence.status,
    rawText: rawEvidence.rawText,
    collectionError: rawEvidence.error,
  };
}

function toPersistedSource(
  source: RawEvidenceSource,
): "health" | "metrics" | "logs" | "business_endpoint" | "container" {
  return source === "business-endpoint" ? "business_endpoint" : source;
}

function fromPersistedSource(
  source: "health" | "metrics" | "logs" | "business_endpoint" | "container",
): RawEvidenceSource {
  return source === "business_endpoint" ? "business-endpoint" : source;
}
