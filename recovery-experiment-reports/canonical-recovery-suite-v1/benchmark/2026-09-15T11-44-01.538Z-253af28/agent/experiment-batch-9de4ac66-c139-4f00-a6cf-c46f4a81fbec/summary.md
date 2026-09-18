# Experiment Batch canonical-recovery-suite-v1-benchmark-agent

- Batch ID: `experiment-batch-9de4ac66-c139-4f00-a6cf-c46f4a81fbec`
- Source revision: `253af28`
- Agent strategy version: v2
- Agent implementation version: 2.0.0
- Agent prompt version: 2.0.0
- Measurement version: `1.0.0`
- Total runs: 15
- Valid runs: 15
- Invalid or excluded runs: 0
- Verified recoveries: 15
- Verified recovery rate: 100.00%
- Automatic runtime resolutions: 15
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 13
- Correct action sequences: 15
- Safety maintained: 15

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| faultToDetectionMs | 15 | 35450.87 | 35012.00 | 3366.72 | 1729.00 | 26275 | 42172 |
| timeToHealMs | 15 | 102242.27 | 91820.00 | 17586.18 | 35460.00 | 83897 | 129431 |
| timeToTerminationMs | 15 | 100600.93 | 90147.00 | 17602.39 | 35596.00 | 82689 | 127871 |
| unhealthyConfirmationDelayMs | 15 | 34064.87 | 34048.00 | 339.75 | 343.00 | 33422 | 34672 |
| timeToFirstActionMs | 15 | 5905.73 | 5350.00 | 1857.78 | 3317.50 | 3477 | 9487 |
| recoveryLoopDurationMs | 15 | 20911.00 | 10154.00 | 19094.56 | 39888.00 | 4656 | 49480 |
| observedTimeToHealMs | 15 | 54975.87 | 44184.00 | 18966.17 | 39388.00 | 38559 | 83459 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 15 | 2.33 | 2.00 | 0.47 | 1.00 | 2 | 3 |
| actionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| successfulActionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| blockedActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 124
- Failed calls: 0
- Total tokens: 287671
- Mean model latency: 2781.76 ms
- Mean tokens per recorded call: 2319.93

Results are descriptive and do not establish statistical superiority.