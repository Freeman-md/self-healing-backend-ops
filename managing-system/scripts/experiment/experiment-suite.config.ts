import { FaultProfileCode, RecoveryMode } from "../../src/generated/prisma/client";

export const experimentSuitePhases = ["validation", "benchmark"] as const;

export type ExperimentSuitePhase = (typeof experimentSuitePhases)[number];

export const canonicalRecoverySuite = {
  id: "canonical-recovery-suite-v1",
  version: "1.0.0",
  recoveryModes: [RecoveryMode.baseline, RecoveryMode.agent],
  faultProfiles: [
    FaultProfileCode.managed_system_application_stopped,
    FaultProfileCode.managed_system_postgres_stopped,
    FaultProfileCode.managed_system_application_and_postgres_stopped,
  ],
  stabilityWindowMs: 10_000,
  monitorStartTimeoutMs: 120_000,
  reportRoot: "recovery-experiment-reports",
  containerReportRoot: "/managing-system/experiment-output",
  phases: {
    validation: {
      repetitions: 1,
      runOrderSeed: "canonical-recovery-suite-v1-validation",
      permitsComparativeClaims: false,
    },
    benchmark: {
      repetitions: 5,
      runOrderSeed: "canonical-recovery-suite-v1-benchmark",
      permitsComparativeClaims: true,
    },
  },
} as const;
