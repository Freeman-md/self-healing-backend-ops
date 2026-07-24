import { RecoveryRepository } from "./recovery.repository";
import type { RecoveryDecision } from "./recovery.types";

export class RecoveryService {
  constructor(private readonly recoveryRepository: RecoveryRepository) {}

  recordRecoveryDecision(input: {
    trialRecordId: string;
    sequenceNumber: number;
    recoveryDecision: RecoveryDecision;
  }): RecoveryDecision {
    return this.recoveryRepository.saveRecoveryDecisionHistory(input);
  }

  findRecoveryDecisionHistory(trialRecordId: string): RecoveryDecision[] {
    return this.recoveryRepository.findRecoveryDecisionsByTrialRecordId(
      trialRecordId,
    );
  }
}
