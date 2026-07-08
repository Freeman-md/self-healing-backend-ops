import { z } from "zod/v4";

import {
  evidenceSignalSchema,
  evidenceSignalStatusSchema,
  evidenceSnapshotSchema,
  evidenceSnapshotStateSchema,
  rawEvidenceSchema,
  rawEvidenceSourceSchema,
  rawEvidenceStatusSchema,
} from "@/schemas/evidence.schema";

export type RawEvidenceSource = z.infer<typeof rawEvidenceSourceSchema>;

export type RawEvidenceStatus = z.infer<typeof rawEvidenceStatusSchema>;

export type EvidenceSignalStatus = z.infer<typeof evidenceSignalStatusSchema>;

export type EvidenceSnapshotState = z.infer<typeof evidenceSnapshotStateSchema>;

export type RawEvidence = z.infer<typeof rawEvidenceSchema>;

export type EvidenceSignal = z.infer<typeof evidenceSignalSchema>;

export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>;
