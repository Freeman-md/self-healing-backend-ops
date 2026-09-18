# Experiment Batch canonical-recovery-suite-v1-validation-baseline

- Batch ID: `experiment-batch-4621244f-f391-42ee-b660-7773ae10cd37`
- Source revision: `334865d`
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
| faultToDetectionMs | 3 | 27173.33 | 40076.00 | 19222.56 | 20722.00 | 0 | 41444 |
| timeToHealMs | 3 | 83939.67 | 86106.00 | 35422.96 | 43343.50 | 39513 | 126200 |
| timeToTerminationMs | 3 | 82236.67 | 84683.00 | 35446.75 | 43361.50 | 37652 | 124375 |
| unhealthyConfirmationDelayMs | 3 | 35829.67 | 35822.00 | 48.07 | 58.50 | 35775 | 35892 |
| timeToFirstActionMs | 3 | 37.67 | 29.00 | 16.68 | 19.00 | 23 | 61 |
| recoveryLoopDurationMs | 3 | 14372.33 | 2320.00 | 17860.33 | 19223.50 | 1175 | 39622 |
| observedTimeToHealMs | 3 | 50202.00 | 38142.00 | 17904.90 | 19282.00 | 36950 | 75514 |

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
- Total tokens: 25963
- Mean model latency: 4336.73 ms
- Mean tokens per recorded call: 2360.27

Results are descriptive and do not establish statistical superiority.