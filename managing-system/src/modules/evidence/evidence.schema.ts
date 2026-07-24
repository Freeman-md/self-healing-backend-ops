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

export const evidenceSignalCodeSchema = z.enum([
  "managed_system_reachability",
  "managed_system_health",
  "managed_system_container_state",
  "database_connectivity",
  "postgres_container_state",
  "metrics_availability",
  "configuration_validity",
  "unknown",
]);

export const incidentTypeCodeSchema = z.enum([
  "managed_system_unreachable",
  "managed_system_service_down",
  "database_connectivity_failure",
  "postgres_unavailable",
  "bad_runtime_configuration",
  "unclassified",
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
  code: evidenceSignalCodeSchema.default("unknown"),
  status: evidenceSignalStatusSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  description: z.string(),
  method: z.enum(["deterministic", "llm"]).default("llm"),
});

export const evidenceSnapshotSchema = z.object({
  id: z.string(),
  rawEvidenceIds: z.array(z.string()),
  createdAt: z.string(),
  targetSystem: z.literal("managed-system"),
  overallState: evidenceSnapshotStateSchema,
  summary: z.string(),
  signals: z.array(evidenceSignalSchema),
  suspectedIncidentTypes: z.array(incidentTypeCodeSchema).default([]),
  contradictions: z.array(z.string()),
});

export type RawEvidenceSource = z.infer<typeof rawEvidenceSourceSchema>;
export type RawEvidenceStatus = z.infer<typeof rawEvidenceStatusSchema>;
export type EvidenceSignalStatus = z.infer<typeof evidenceSignalStatusSchema>;
export type EvidenceSignalCode = z.infer<typeof evidenceSignalCodeSchema>;
export type IncidentTypeCode = z.infer<typeof incidentTypeCodeSchema>;
export type EvidenceSnapshotState = z.infer<typeof evidenceSnapshotStateSchema>;
export type RawEvidence = z.infer<typeof rawEvidenceSchema>;
export type EvidenceSignal = z.infer<typeof evidenceSignalSchema>;
export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>;
