# Experiment Batch canonical-recovery-suite-v1-validation-baseline

- Batch ID: `experiment-batch-22b7d820-ff1f-4d59-9ab3-3b0c0754592f`
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
| faultToDetectionMs | 3 | 35112.00 | 37138.00 | 3960.39 | 4522.00 | 29577 | 38621 |
| timeToHealMs | 3 | 92343.67 | 83997.00 | 18650.33 | 21668.00 | 74849 | 118185 |
| timeToTerminationMs | 3 | 90817.67 | 82678.00 | 18397.73 | 21401.50 | 73486 | 116289 |
| unhealthyConfirmationDelayMs | 3 | 35293.33 | 35636.00 | 865.79 | 1018.00 | 34104 | 36140 |
| timeToFirstActionMs | 3 | 35.00 | 30.00 | 13.14 | 15.50 | 22 | 53 |
| recoveryLoopDurationMs | 3 | 14225.00 | 2319.00 | 17664.22 | 19019.00 | 1159 | 39197 |
| observedTimeToHealMs | 3 | 49518.33 | 37955.00 | 16819.02 | 18001.00 | 37299 | 73301 |

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
- Total tokens: 25909
- Mean model latency: 3698.91 ms
- Mean tokens per recorded call: 2355.36

Results are descriptive and do not establish statistical superiority.