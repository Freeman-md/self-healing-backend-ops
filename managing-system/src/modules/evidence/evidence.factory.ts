import {
  rawEvidenceSchema,
  type RawEvidence,
  type RawEvidenceSource,
} from "./evidence.schema";

type RawEvidenceInput = {
  source: RawEvidenceSource;
  target: string;
  collectedAt: string;
};

type CollectedRawEvidenceInput = RawEvidenceInput & {
  rawText: string;
};

type FailedRawEvidenceInput = RawEvidenceInput & {
  rawText: string | null;
  error: string;
};

export class EvidenceFactory {
  createCollectedRawEvidence(
    input: CollectedRawEvidenceInput,
  ): RawEvidence {
    return rawEvidenceSchema.parse({
      ...input,
      id: this.createRawEvidenceId(input.source, input.collectedAt),
      status: "collected",
      error: null,
    });
  }

  createFailedRawEvidence(input: FailedRawEvidenceInput): RawEvidence {
    return rawEvidenceSchema.parse({
      ...input,
      id: this.createRawEvidenceId(input.source, input.collectedAt),
      status: "failed",
    });
  }

  private createRawEvidenceId(
    source: RawEvidenceSource,
    collectedAt: string,
  ): string {
    return `raw-${source}-${collectedAt}`;
  }
}
