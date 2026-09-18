# canonical-recovery-suite-v1 validation

- Campaign ID: `2026-09-15T09-59-19.275Z-253af28`
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
| agent | v2 | 2.0.0 | 2.0.0 |

## Fault-Injection Runs

| Mode | Batch ID | Runs | Valid | Invalid | Verified | Automatic | Disagreements | Safety maintained | Median time to heal (ms) | Model calls | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | `experiment-batch-a1abd2a7-cff2-478d-8546-51e481a8caf0` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 82138 | 11 | 26345 |
| agent | `experiment-batch-e79adaf7-78f0-4cd2-9841-8843ed2fdcb5` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 92158 | 23 | 51790 |

This campaign validates instrumentation only and does not support comparative performance claims.