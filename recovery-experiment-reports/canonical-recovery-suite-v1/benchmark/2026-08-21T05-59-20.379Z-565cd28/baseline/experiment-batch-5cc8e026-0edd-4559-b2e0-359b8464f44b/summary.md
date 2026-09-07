# Experiment Batch canonical-recovery-suite-v1-benchmark-baseline

- Batch ID: `experiment-batch-5cc8e026-0edd-4559-b2e0-359b8464f44b`
- Source revision: `565cd28`
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
| faultToDetectionMs | 15 | 37840.87 | 38174.00 | 3017.86 | 1945.00 | 27391 | 41099 |
| timeToHealMs | 15 | 109443.47 | 99463.00 | 18186.88 | 38011.00 | 86746 | 135327 |
| timeToTerminationMs | 15 | 97542.80 | 87973.00 | 18167.09 | 37869.00 | 74577 | 123537 |
| unhealthyConfirmationDelayMs | 15 | 36756.00 | 35776.00 | 2832.94 | 885.00 | 34755 | 46011 |
| timeToFirstActionMs | 15 | 25.93 | 24.00 | 8.14 | 8.00 | 14 | 47 |
| recoveryLoopDurationMs | 15 | 14303.27 | 2254.00 | 17817.35 | 37618.00 | 1157 | 40369 |
| observedTimeToHealMs | 15 | 51059.27 | 38118.00 | 17309.36 | 36993.00 | 36333 | 75796 |

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
- Total tokens: 131375
- Mean model latency: 4810.02 ms
- Mean tokens per recorded call: 2388.64

Results are descriptive and do not establish statistical superiority.
