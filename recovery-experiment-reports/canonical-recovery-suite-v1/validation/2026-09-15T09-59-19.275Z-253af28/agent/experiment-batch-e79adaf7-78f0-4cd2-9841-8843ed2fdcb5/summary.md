# Experiment Batch canonical-recovery-suite-v1-validation-agent

- Batch ID: `experiment-batch-e79adaf7-78f0-4cd2-9841-8843ed2fdcb5`
- Source revision: `253af28`
- Agent strategy version: v2
- Agent implementation version: 2.0.0
- Agent prompt version: 2.0.0
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
| faultToDetectionMs | 3 | 24945.67 | 36203.00 | 17667.15 | 19317.00 | 0 | 38634 |
| timeToHealMs | 3 | 89264.67 | 92158.00 | 38897.85 | 47574.00 | 40244 | 135392 |
| timeToTerminationMs | 3 | 87607.00 | 90577.00 | 39147.78 | 47877.00 | 38245 | 133999 |
| unhealthyConfirmationDelayMs | 3 | 35241.67 | 35301.00 | 304.19 | 369.00 | 34843 | 35581 |
| timeToFirstActionMs | 3 | 5884.00 | 5949.00 | 422.59 | 514.50 | 5337 | 6366 |
| recoveryLoopDurationMs | 3 | 21591.33 | 7652.00 | 19747.15 | 20957.00 | 7604 | 49518 |
| observedTimeToHealMs | 3 | 56833.00 | 42905.00 | 19987.78 | 21302.00 | 42495 | 85099 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 3 | 2.33 | 2.00 | 0.47 | 0.50 | 2 | 3 |
| actionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| successfulActionCount | 3 | 1.33 | 1.00 | 0.47 | 0.50 | 1 | 2 |
| blockedActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 23
- Failed calls: 0
- Total tokens: 51790
- Mean model latency: 3267.43 ms
- Mean tokens per recorded call: 2251.74

Results are descriptive and do not establish statistical superiority.