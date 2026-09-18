# Experiment Batch canonical-recovery-suite-v1-validation-baseline

- Batch ID: `experiment-batch-a1abd2a7-cff2-478d-8546-51e481a8caf0`
- Source revision: `253af28`
- Agent strategy version: not recorded (historical or baseline)
- Agent implementation version: not recorded
- Agent prompt version: not recorded
- Measurement version: `1.0.0`
- Total runs: 3
- Valid runs: 3
- Invalid or excluded runs: 0
- Verified recoveries: 3
- Verified recovery rate: 100.00%
- Automatic runtime resolutions: 3
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 3
- Correct action sequences: 3
- Safety maintained: 3

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| faultToDetectionMs | 3 | 34286.33 | 36158.00 | 5281.02 | 6261.50 | 27089 | 39612 |
| timeToHealMs | 3 | 94289.33 | 82138.00 | 19701.76 | 21714.00 | 78651 | 122079 |
| timeToTerminationMs | 3 | 92719.33 | 80713.00 | 19876.62 | 22011.50 | 76711 | 120734 |
| unhealthyConfirmationDelayMs | 3 | 36335.00 | 36359.00 | 595.47 | 729.00 | 35594 | 37052 |
| timeToFirstActionMs | 3 | 41.67 | 47.00 | 8.99 | 10.00 | 29 | 49 |
| recoveryLoopDurationMs | 3 | 14289.67 | 2262.00 | 17688.56 | 18995.50 | 1308 | 39299 |
| observedTimeToHealMs | 3 | 50624.67 | 39314.00 | 17173.47 | 18613.00 | 37667 | 74893 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| actionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| successfulActionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| blockedActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 11
- Failed calls: 0
- Total tokens: 26345
- Mean model latency: 4320.73 ms
- Mean tokens per recorded call: 2395.00

Results are descriptive and do not establish statistical superiority.