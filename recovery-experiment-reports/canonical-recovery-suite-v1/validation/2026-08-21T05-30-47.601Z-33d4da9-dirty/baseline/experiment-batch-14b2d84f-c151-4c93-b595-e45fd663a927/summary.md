# Experiment Batch canonical-recovery-suite-v1-validation-baseline

- Batch ID: `experiment-batch-14b2d84f-c151-4c93-b595-e45fd663a927`
- Source revision: `33d4da9-dirty`
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
| faultToDetectionMs | 3 | 34081.00 | 36828.00 | 9668.89 | 11600.50 | 21107 | 44308 |
| timeToHealMs | 3 | 103381.33 | 101432.00 | 21984.15 | 26872.00 | 77484 | 131228 |
| timeToTerminationMs | 3 | 91660.00 | 89671.00 | 22066.19 | 26970.50 | 65684 | 119625 |
| unhealthyConfirmationDelayMs | 3 | 35904.00 | 35770.00 | 918.56 | 1119.00 | 34852 | 37090 |
| timeToFirstActionMs | 3 | 29.00 | 22.00 | 15.12 | 17.50 | 15 | 50 |
| recoveryLoopDurationMs | 3 | 14164.00 | 2260.00 | 17622.64 | 18962.00 | 1154 | 39078 |
| observedTimeToHealMs | 3 | 50068.00 | 37112.00 | 18455.65 | 19622.00 | 36924 | 76168 |

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
- Total tokens: 26655
- Mean model latency: 4224.91 ms
- Mean tokens per recorded call: 2423.18

Pilot results validate instrumentation only and do not establish comparative superiority.