# Experiment Batch canonical-recovery-suite-v1-benchmark-agent

- Batch ID: `experiment-batch-70c377ea-1a29-4356-8d9f-124238e6e749`
- Source revision: `253af28`
- Agent strategy version: v1
- Agent implementation version: 1.0.0
- Agent prompt version: 1.0.0
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
| faultToDetectionMs | 15 | 36838.00 | 36975.00 | 2965.42 | 2645.00 | 27148 | 39661 |
| timeToHealMs | 15 | 104818.07 | 92111.00 | 20393.53 | 33941.50 | 80697 | 144332 |
| timeToTerminationMs | 15 | 103147.67 | 90714.00 | 20412.20 | 34105.00 | 78978 | 142658 |
| unhealthyConfirmationDelayMs | 15 | 35177.40 | 35638.00 | 865.43 | 1314.50 | 33592 | 36384 |
| timeToFirstActionMs | 15 | 8094.13 | 7030.00 | 2472.61 | 2810.00 | 6013 | 14681 |
| recoveryLoopDurationMs | 15 | 22437.67 | 10823.00 | 18392.73 | 37367.00 | 7227 | 53343 |
| observedTimeToHealMs | 15 | 57615.07 | 46099.00 | 18009.43 | 37005.50 | 42053 | 87439 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 15 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| actionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| successfulActionCount | 15 | 1.33 | 1.00 | 0.47 | 1.00 | 1 | 2 |
| blockedActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 15 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 85
- Failed calls: 0
- Total tokens: 170692
- Mean model latency: 4251.98 ms
- Mean tokens per recorded call: 2008.14

Results are descriptive and do not establish statistical superiority.