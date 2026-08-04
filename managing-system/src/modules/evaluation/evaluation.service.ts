import type { TrialRecord } from "@/modules/trial";

import { EvaluationFactory } from "./evaluation.factory";
import { EvaluationRepository } from "./evaluation.repository";
import type { EvaluationSummary } from "./evaluation.types";

export class EvaluationService {
  constructor(
    private readonly evaluationFactory: EvaluationFactory,
    private readonly evaluationRepository: EvaluationRepository,
  ) {}

  createEvaluationSummary(
    trialRecord: TrialRecord,
    reason: string,
  ): EvaluationSummary {
    return this.evaluationFactory.createEvaluationSummary(trialRecord, reason);
  }

  async saveEvaluationSummary(
    summary: EvaluationSummary,
  ): Promise<EvaluationSummary> {
    return this.evaluationRepository.saveEvaluationSummary(summary);
  }
}
