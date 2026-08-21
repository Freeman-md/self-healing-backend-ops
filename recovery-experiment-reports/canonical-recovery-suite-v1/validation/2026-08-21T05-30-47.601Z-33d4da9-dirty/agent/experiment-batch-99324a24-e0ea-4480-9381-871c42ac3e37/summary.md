# Experiment Batch canonical-recovery-suite-v1-validation-agent

- Batch ID: `experiment-batch-99324a24-e0ea-4480-9381-871c42ac3e37`
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
| faultToDetectionMs | 3 | 32722.67 | 37528.00 | 8636.15 | 9724.00 | 20596 | 40044 |
| timeToHealMs | 3 | 109718.33 | 108280.00 | 19474.30 | 23818.50 | 86619 | 134256 |
| timeToTerminationMs | 3 | 98002.00 | 96690.00 | 19326.71 | 23643.00 | 75015 | 122301 |
| unhealthyConfirmationDelayMs | 3 | 36015.33 | 35588.00 | 1299.55 | 1548.00 | 34681 | 37777 |
| timeToFirstActionMs | 3 | 6973.00 | 7356.00 | 709.00 | 802.50 | 5979 | 7584 |
| recoveryLoopDurationMs | 3 | 20842.00 | 9807.00 | 16537.92 | 17858.50 | 8501 | 44218 |
| observedTimeToHealMs | 3 | 56857.33 | 46278.00 | 15589.98 | 16752.00 | 45395 | 78899 |

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
- Total tokens: 34385
- Mean model latency: 4090.88 ms
- Mean tokens per recorded call: 2022.65

Pilot results validate instrumentation only and do not establish comparative superiority.