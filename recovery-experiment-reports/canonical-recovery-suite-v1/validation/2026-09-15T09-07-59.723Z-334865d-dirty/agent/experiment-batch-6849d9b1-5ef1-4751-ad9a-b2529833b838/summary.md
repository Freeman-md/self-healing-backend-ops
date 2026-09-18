# Experiment Batch canonical-recovery-suite-v1-validation-agent

- Batch ID: `experiment-batch-6849d9b1-5ef1-4751-ad9a-b2529833b838`
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
| faultToDetectionMs | 3 | 32990.67 | 36825.00 | 6254.86 | 6903.50 | 24170 | 37977 |
| timeToHealMs | 3 | 98366.33 | 89600.00 | 21179.39 | 24803.50 | 77946 | 127553 |
| timeToTerminationMs | 3 | 97000.33 | 88434.00 | 21167.38 | 24840.50 | 76443 | 126124 |
| unhealthyConfirmationDelayMs | 3 | 35504.67 | 35341.00 | 609.98 | 733.50 | 34853 | 36320 |
| timeToFirstActionMs | 3 | 6807.33 | 6823.00 | 305.98 | 374.50 | 6425 | 7174 |
| recoveryLoopDurationMs | 3 | 20933.67 | 9063.00 | 17299.27 | 18526.00 | 8343 | 45395 |
| observedTimeToHealMs | 3 | 56438.33 | 44663.00 | 17183.75 | 18410.00 | 43916 | 80736 |

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
- Total tokens: 34711
- Mean model latency: 3858.53 ms
- Mean tokens per recorded call: 2041.82

Results are descriptive and do not establish statistical superiority.