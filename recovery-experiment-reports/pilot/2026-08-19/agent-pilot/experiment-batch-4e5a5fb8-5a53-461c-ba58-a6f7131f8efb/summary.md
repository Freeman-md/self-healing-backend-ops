# Experiment Batch agent-pilot

- Batch ID: `experiment-batch-4e5a5fb8-5a53-461c-ba58-a6f7131f8efb`
- Source revision: `33d4da9`
- Measurement version: `1.0.0`
- Total runs: 6
- Valid runs: 6
- Invalid or excluded runs: 0
- Verified recoveries: 6
- Verified recovery rate: 100.00%
- Automatic runtime resolutions: 6
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 4
- Correct action sequences: 6
- Safety maintained: 6

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| faultToDetectionMs | 6 | 13927.67 | 14115.50 | 2915.76 | 3878.75 | 9726 | 18403 |
| timeToHealMs | 6 | 69825.83 | 62095.00 | 16266.25 | 22692.25 | 54413 | 97867 |
| timeToTerminationMs | 6 | 57882.33 | 50052.50 | 16341.05 | 22796.75 | 42142 | 85777 |
| unhealthyConfirmationDelayMs | 6 | 11220.00 | 10854.50 | 1082.70 | 1315.00 | 10050 | 13206 |
| timeToFirstActionMs | 6 | 10615.67 | 9964.00 | 2989.85 | 2428.25 | 7231 | 16592 |
| recoveryLoopDurationMs | 6 | 24802.33 | 12560.00 | 18810.15 | 27487.25 | 10666 | 55557 |
| observedTimeToHealMs | 6 | 36022.33 | 24328.50 | 18342.95 | 25581.50 | 21430 | 66502 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 6 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| actionCount | 6 | 1.33 | 1.00 | 0.47 | 0.75 | 1 | 2 |
| successfulActionCount | 6 | 1.33 | 1.00 | 0.47 | 0.75 | 1 | 2 |
| blockedActionCount | 6 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 6 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 6 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 34
- Failed calls: 0
- Total tokens: 68077
- Mean model latency: 4744.32 ms
- Mean tokens per recorded call: 2002.26

Pilot results validate instrumentation only and do not establish comparative superiority.