import { z } from "zod/v4";

export const rawEvidenceSourceSchema = z.enum([
  "health",
  "metrics",
  "logs",
  "business-endpoint",
  "container",
]);

export const rawEvidenceStatusSchema = z.enum(["collected", "failed"]);

export const evidenceSignalStatusSchema = z.enum([
  "normal",
  "warning",
  "critical",
  "unknown",
]);

export const evidenceSnapshotStateSchema = z.enum([
  "healthy",
  "degraded",
  "unhealthy",
  "unknown",
]);

export const rawEvidenceSchema = z.object({
  id: z.string(),
  source: rawEvidenceSourceSchema,
  target: z.string(),
  collectedAt: z.string(),
  status: rawEvidenceStatusSchema,
  rawText: z.string().nullable(),
  error: z.string().nullable(),
});

export const evidenceSignalSchema = z.object({
  source: rawEvidenceSourceSchema,
  name: z.string(),
  status: evidenceSignalStatusSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  description: z.string(),
});

export const evidenceSnapshotSchema = z.object({
  id: z.string(),
  rawEvidenceIds: z.array(z.string()),
  createdAt: z.string(),
  targetSystem: z.literal("managed-system"),
  overallState: evidenceSnapshotStateSchema,
  summary: z.string(),
  signals: z.array(evidenceSignalSchema),
  suspectedIncidentTypes: z.array(z.string()),
  contradictions: z.array(z.string()),
});
