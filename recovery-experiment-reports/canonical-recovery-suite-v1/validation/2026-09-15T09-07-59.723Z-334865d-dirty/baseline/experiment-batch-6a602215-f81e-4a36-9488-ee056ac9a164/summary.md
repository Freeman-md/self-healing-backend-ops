# Experiment Batch canonical-recovery-suite-v1-validation-baseline

- Batch ID: `experiment-batch-6a602215-f81e-4a36-9488-ee056ac9a164`
- Source revision: `334865d-dirty`
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
| faultToDetectionMs | 3 | 34502.33 | 36547.00 | 3752.47 | 4241.00 | 29239 | 37721 |
| timeToHealMs | 3 | 92002.67 | 83000.00 | 19740.91 | 22886.00 | 73618 | 119390 |
| timeToTerminationMs | 3 | 90306.67 | 81503.00 | 19907.19 | 23158.50 | 71550 | 117867 |
| unhealthyConfirmationDelayMs | 3 | 34860.00 | 34646.00 | 568.38 | 671.00 | 34296 | 35638 |
| timeToFirstActionMs | 3 | 29.67 | 24.00 | 11.73 | 13.50 | 19 | 46 |
| recoveryLoopDurationMs | 3 | 13943.00 | 2270.00 | 17296.07 | 18615.50 | 1164 | 38395 |
| observedTimeToHealMs | 3 | 48803.00 | 36566.00 | 17842.97 | 19111.50 | 35810 | 74033 |

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
- Total tokens: 25996
- Mean model latency: 3742.73 ms
- Mean tokens per recorded call: 2363.27

Results are descriptive and do not establish statistical superiority.