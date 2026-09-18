# Experiment Batch canonical-recovery-suite-v1-validation-agent

- Batch ID: `experiment-batch-39286809-45b6-4420-97d1-9246793dcff7`
- Source revision: `253af28`
- Agent strategy version: v1
- Agent implementation version: 1.0.0
- Agent prompt version: 1.0.0
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
| faultToDetectionMs | 3 | 36043.00 | 39140.00 | 6656.35 | 7698.50 | 26796 | 42193 |
| timeToHealMs | 3 | 100024.00 | 94182.00 | 21128.81 | 25378.00 | 77567 | 128323 |
| timeToTerminationMs | 3 | 98319.00 | 92401.00 | 21246.63 | 25512.00 | 75766 | 126790 |
| unhealthyConfirmationDelayMs | 3 | 35135.00 | 35320.00 | 406.60 | 471.50 | 34571 | 35514 |
| timeToFirstActionMs | 3 | 6478.33 | 6534.00 | 454.46 | 554.50 | 5896 | 7005 |
| recoveryLoopDurationMs | 3 | 20657.67 | 8821.00 | 17214.08 | 18423.00 | 8153 | 44999 |
| observedTimeToHealMs | 3 | 55792.67 | 43473.00 | 17479.95 | 18560.50 | 43392 | 80513 |

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
- Total tokens: 33598
- Mean model latency: 3536.65 ms
- Mean tokens per recorded call: 1976.35

Results are descriptive and do not establish statistical superiority.