# Benchmark Errata

The campaign remains valid evidence for recovery outcomes, action sequences, safety observations, incident-code overlap and model usage. A closure review identified that `timeToHealMs` used `oracleCheckedAt`, which was recorded after the 10-second stability window, rather than the first independently healthy oracle observation.

Consequently, the exported `timeToHealMs` values in this campaign include the stability window and must not be used for recovery-timing comparison. The raw fault, monitor, trial and oracle records remain unchanged. Milestone 7 now records `oracleFirstHealthyObservedAt` separately and calculates future `timeToHealMs` from fault injection to that observation while retaining `oracleCheckedAt` as the stability-completion boundary.

No historical run observation, outcome or timing value has been rewritten. The known runtime values `promptVersion: "1.0.0"` and `maxRecoverySteps: 3` were added retrospectively to both batch configurations to disclose provenance that the original exporter omitted. A later benchmark must use a source revision containing the corrected measurement boundary before its `timeToHealMs` results are compared with this or another implementation.
