# Experiment Batch m9-non-idle

- Batch ID: `experiment-batch-2ef1207d-af2b-4682-972d-3401dc63fdca`
- Source revision: `ae4b08f420e948293f8e6867ff06eda789d866c3`
- Agent strategy version: v2
- Agent implementation version: 2.0.0
- Agent prompt version: 2.0.0
- Measurement version: `2.0.0`
- Total runs: 1
- Valid runs: 1
- Invalid or excluded runs: 0
- Verified recoveries: 1
- Verified recovery rate: 100.00%
- Verified escalations: 0
- Verified escalation rate: not available
- Automatic runtime resolutions: 1
- Automatic resolution rate: 100.00%
- Runtime/oracle disagreements: 0
- Correct diagnoses: 1
- Correct action sequences: 1
- Safety maintained: 1

## Timing

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| timeToDiagnosisReadyMs | 1 | 3339.00 | 3339.00 | 0.00 | 0.00 | 3339 | 3339 |
| timeToPlanReadyMs | 1 | 3339.00 | 3339.00 | 0.00 | 0.00 | 3339 | 3339 |
| faultToDetectionMs | 1 | 24920.00 | 24920.00 | 0.00 | 0.00 | 24920 | 24920 |
| timeToHealMs | 1 | 77807.00 | 77807.00 | 0.00 | 0.00 | 77807 | 77807 |
| timeToTerminationMs | 1 | 76608.00 | 76608.00 | 0.00 | 0.00 | 76608 | 76608 |
| unhealthyConfirmationDelayMs | 1 | 34776.00 | 34776.00 | 0.00 | 0.00 | 34776 | 34776 |
| timeToFirstActionMs | 1 | 4486.00 | 4486.00 | 0.00 | 0.00 | 4486 | 4486 |
| recoveryLoopDurationMs | 1 | 6645.00 | 6645.00 | 0.00 | 0.00 | 6645 | 6645 |
| observedTimeToHealMs | 1 | 41421.00 | 41421.00 | 0.00 | 0.00 | 41421 | 41421 |

## Decisions and Actions

| Measure | N | Mean | Median | SD | IQR | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| decisionCount | 1 | 2.00 | 2.00 | 0.00 | 0.00 | 2 | 2 |
| actionCount | 1 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| successfulActionCount | 1 | 1.00 | 1.00 | 0.00 | 0.00 | 1 | 1 |
| blockedActionCount | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| failedActionCount | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| unnecessaryActionCount | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0 |

## Exclusions

No runs were excluded.

## Model Usage

- Calls: 7
- Failed calls: 0
- Total tokens: 15034
- Mean model latency: 2756.00 ms
- Mean tokens per recorded call: 2147.71

Results are descriptive and do not establish statistical superiority.