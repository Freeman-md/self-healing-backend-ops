# Experiment Batch m9-reuse

- Batch ID: `experiment-batch-689566b1-a412-438d-87ce-87bb418bfba4`
- Source revision: `ac601e9055659dab374ba37614ba5b62f01b71a6`
- Agent strategy version: v2
- Agent implementation version: 2.1.0
- Agent prompt version: 2.1.0
- Measurement version: `2.0.0`
- Total runs: 2
- Valid runs: 2
- Invalid or excluded runs: 0
- Verified recoveries: 2
- Verified recovery rate: 100.00%
- Verified escalations: 0
- Verified escalation rate: not available
- Automatic runtime resolutions: 2
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 2
- Correct action sequences: 2
- Safety maintained: 2

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| timeToDiagnosisReadyMs | 2 | 7267.00 | 7267.00 | 477.00 | 477.00 | 6790 | 7744 |
| timeToPlanReadyMs | 2 | 9262.50 | 9262.50 | 664.50 | 664.50 | 8598 | 9927 |
| faultToDetectionMs | 2 | 12510.50 | 12510.50 | 6199.50 | 6199.50 | 6311 | 18710 |
| timeToHealMs | 2 | 76011.00 | 76011.00 | 6548.00 | 6548.00 | 69463 | 82559 |
| timeToTerminationMs | 2 | 74209.50 | 74209.50 | 6598.50 | 6598.50 | 67611 | 80808 |
| unhealthyConfirmationDelayMs | 2 | 35585.50 | 35585.50 | 1927.50 | 1927.50 | 33658 | 37513 |
| timeToFirstActionMs | 2 | 10779.50 | 10779.50 | 633.50 | 633.50 | 10146 | 11413 |
| recoveryLoopDurationMs | 2 | 13016.50 | 13016.50 | 618.50 | 618.50 | 12398 | 13635 |
| observedTimeToHealMs | 2 | 48602.00 | 48602.00 | 2546.00 | 2546.00 | 46056 | 51148 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 2 | 2.00 | 2.00 | 0.00 | 0.00 | 2 | 2 |
| actionCount | 2 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| successfulActionCount | 2 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| blockedActionCount | 2 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 2 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 2 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 21
- Failed calls: 0
- Total tokens: 48834
- Mean model latency: 2787.05 ms
- Mean tokens per recorded call: 2325.43

Results are descriptive and do not establish statistical superiority.