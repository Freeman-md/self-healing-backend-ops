# canonical-recovery-suite-v1 validation

- Campaign ID: `2026-09-15T09-40-36.881Z-253af28`
- Source revision: `253af28`
- Suite version: `1.0.0`
- Repetitions per mode/profile cell: 1
- Comparative claims permitted: no

## Healthy Controls

| Mode | Duration (ms) | Health stable | Monitor trials | Action executions | Passed |
|---|---:|---:|---:|---:|---:|
| baseline | 30000 | true | 0 | 0 | true |
| agent | 30000 | true | 0 | 0 | true |

## Agent Versions

| Mode | Strategy | Implementation | Agent prompt |
|---|---|---|---|
| baseline | not recorded | not recorded | not recorded |
| agent | v1 | 1.0.0 | 1.0.0 |

## Fault-Injection Runs

| Mode | Batch ID | Runs | Valid | Invalid | Verified | Automatic | Disagreements | Safety maintained | Median time to heal (ms) | Model calls | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | `experiment-batch-22b7d820-ff1f-4d59-9ab3-3b0c0754592f` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 83997 | 11 | 25909 |
| agent | `experiment-batch-39286809-45b6-4420-97d1-9246793dcff7` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 94182 | 17 | 33598 |

This campaign validates instrumentation only and does not support comparative performance claims.