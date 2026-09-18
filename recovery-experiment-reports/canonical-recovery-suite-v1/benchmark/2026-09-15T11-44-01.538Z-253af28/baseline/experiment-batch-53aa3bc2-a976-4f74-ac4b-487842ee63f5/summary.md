# Experiment Batch canonical-recovery-suite-v1-benchmark-baseline

- Batch ID: `experiment-batch-53aa3bc2-a976-4f74-ac4b-487842ee63f5`
- Source revision: `253af28`
- Agent strategy version: not recorded (historical or baseline)
- Agent implementation version: not recorded
- Agent prompt version: not recorded
- Measurement version: `1.0.0`
- Total runs: 15
- Valid runs: 15
- Invalid or excluded runs: 0
- Verified recoveries: 15
- Verified recovery rate: 100.00%
- Automatic runtime resolutions: 15
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 15
- Correct action sequences: 15
- Safety maintained: 15

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| faultToDetectionMs | 15 | 33392.40 | 35780.00 | 8993.32 | 1498.00 | 0 | 38337 |
| timeToHealMs | 15 | 88302.20 | 79492.00 | 23150.09 | 36026.00 | 31238 | 120945 |
| timeToTerminationMs | 15 | 86750.33 | 78059.00 | 23232.84 | 36127.00 | 29403 | 118946 |
| unhealthyConfirmationDelayMs | 15 | 34145.93 | 34185.00 | 551.14 | 860.00 | 33320 | 35135 |
| timeToFirstActionMs | 15 | 28.60 | 27.00 | 10.29 | 9.00 | 17 | 53 |
| recoveryLoopDurationMs | 15 | 14018.47 | 2273.00 | 17412.93 | 36467.00 | 1138 | 39976 |
| observedTimeToHealMs | 15 | 48164.40 | 36216.00 | 17585.91 | 36286.50 | 34727 | 74255 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| actionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| successfulActionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| blockedActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 55
- Failed calls: 0
- Total tokens: 130463
- Mean model latency: 3304.05 ms
- Mean tokens per recorded call: 2372.05

Results are descriptive and do not establish statistical superiority.