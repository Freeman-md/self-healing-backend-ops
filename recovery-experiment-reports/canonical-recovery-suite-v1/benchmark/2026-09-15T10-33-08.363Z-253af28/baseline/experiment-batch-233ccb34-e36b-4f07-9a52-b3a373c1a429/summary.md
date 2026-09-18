# Experiment Batch canonical-recovery-suite-v1-benchmark-baseline

- Batch ID: `experiment-batch-233ccb34-e36b-4f07-9a52-b3a373c1a429`
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
| faultToDetectionMs | 15 | 36747.33 | 37455.00 | 3041.70 | 1392.50 | 26158 | 39338 |
| timeToHealMs | 15 | 96513.93 | 85604.00 | 18264.57 | 37719.50 | 74752 | 123628 |
| timeToTerminationMs | 15 | 94893.47 | 83893.00 | 18246.79 | 37379.00 | 73321 | 121840 |
| unhealthyConfirmationDelayMs | 15 | 35989.60 | 35109.00 | 2421.13 | 1259.50 | 34024 | 44293 |
| timeToFirstActionMs | 15 | 30.07 | 27.00 | 9.15 | 5.00 | 21 | 52 |
| recoveryLoopDurationMs | 15 | 14522.27 | 2274.00 | 18059.35 | 37946.50 | 1170 | 40800 |
| observedTimeToHealMs | 15 | 50511.87 | 39361.00 | 17421.77 | 37303.00 | 36067 | 75909 |

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
- Total tokens: 130788
- Mean model latency: 4357.58 ms
- Mean tokens per recorded call: 2377.96

Results are descriptive and do not establish statistical superiority.