# Experiment Batch canonical-recovery-suite-v1-benchmark-agent

- Batch ID: `experiment-batch-cee7c975-85a9-4da6-8891-aa6823bcb01f`
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
- Correct diagnoses: 12
- Correct action sequences: 15
- Safety maintained: 15

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| faultToDetectionMs | 15 | 40389.47 | 39930.00 | 5157.84 | 2542.50 | 27678 | 54359 |
| timeToHealMs | 15 | 119849.80 | 109908.00 | 18178.05 | 35112.50 | 93792 | 146861 |
| timeToTerminationMs | 15 | 108011.87 | 97704.00 | 18125.46 | 35308.00 | 82079 | 134857 |
| unhealthyConfirmationDelayMs | 15 | 35979.40 | 35759.00 | 1154.30 | 2006.50 | 34071 | 37734 |
| timeToFirstActionMs | 15 | 9011.73 | 8983.00 | 936.44 | 907.50 | 7781 | 11329 |
| recoveryLoopDurationMs | 15 | 23486.53 | 11537.00 | 17737.42 | 36664.00 | 9129 | 51260 |
| observedTimeToHealMs | 15 | 59465.93 | 47932.00 | 17785.09 | 36582.00 | 44400 | 86208 |

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
- Total tokens: 169698
- Mean model latency: 4500.76 ms
- Mean tokens per recorded call: 1996.45

Results are descriptive and do not establish statistical superiority.
