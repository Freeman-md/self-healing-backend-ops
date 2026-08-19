import type { EvidenceSnapshot } from "@/modules/evidence";

import {
  findMatchingBaselineRule,
  type BaselineRuleMatch,
  type BaselineRule,
} from "./recovery.baseline.rules";
import { RecoveryRepository } from "./recovery.repository";
import type { RecoveryDecision } from "./recovery.types";

export class RecoveryService {
  constructor(private readonly recoveryRepository: RecoveryRepository) {}

  async recordRecoveryDecision(input: {
    trialRecordId: string;
    sequenceNumber: number;
    recoveryDecision: RecoveryDecision;
  }): Promise<RecoveryDecision> {
    return this.recoveryRepository.saveRecoveryDecisionHistory(input);
  }

  async findRecoveryDecisionHistory(trialRecordId: string): Promise<RecoveryDecision[]> {
    return this.recoveryRepository.findRecoveryDecisionsByTrialRecordId(trialRecordId);
  }

  async findMatchingBaselineRule(
    snapshot: EvidenceSnapshot,
  ): Promise<{ rule: BaselineRule; match: BaselineRuleMatch } | null> {
    const rules = await this.recoveryRepository.listActiveBaselineRules();

    return findMatchingBaselineRule(snapshot, rules);
  }
}
