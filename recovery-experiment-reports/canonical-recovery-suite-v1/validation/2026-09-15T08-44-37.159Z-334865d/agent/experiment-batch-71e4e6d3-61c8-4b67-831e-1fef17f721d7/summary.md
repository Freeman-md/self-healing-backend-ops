# Experiment Batch canonical-recovery-suite-v1-validation-agent

- Batch ID: `experiment-batch-71e4e6d3-61c8-4b67-831e-1fef17f721d7`
- Source revision: `334865d`
- Measurement version: `1.0.0`
- Total runs: 3
- Valid runs: 3
- Invalid or excluded runs: 0
- Verified recoveries: 3
- Verified recovery rate: 100.00%
- Automatic runtime resolutions: 3
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 2
- Correct action sequences: 3
- Safety maintained: 3

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| faultToDetectionMs | 3 | 34782.67 | 38980.00 | 6538.89 | 7136.00 | 25548 | 39820 |
| timeToHealMs | 3 | 100089.33 | 93269.00 | 19232.64 | 22802.50 | 80697 | 126302 |
| timeToTerminationMs | 3 | 98387.33 | 91381.00 | 19457.85 | 23045.50 | 78845 | 124936 |
| unhealthyConfirmationDelayMs | 3 | 34972.33 | 34602.00 | 693.51 | 786.50 | 34371 | 35944 |
| timeToFirstActionMs | 3 | 6753.67 | 6516.00 | 929.39 | 1119.50 | 5753 | 7992 |
| recoveryLoopDurationMs | 3 | 20658.33 | 10218.00 | 16588.96 | 18194.50 | 7684 | 44073 |
| observedTimeToHealMs | 3 | 55630.67 | 44820.00 | 16138.80 | 17408.00 | 43628 | 78444 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 3 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| actionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| successfulActionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| blockedActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 17
- Failed calls: 0
- Total tokens: 33958
- Mean model latency: 3794.12 ms
- Mean tokens per recorded call: 1997.53

Results are descriptive and do not establish statistical superiority.