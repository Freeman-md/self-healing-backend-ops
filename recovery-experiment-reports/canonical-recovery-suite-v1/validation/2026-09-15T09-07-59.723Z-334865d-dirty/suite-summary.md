# canonical-recovery-suite-v1 validation

- Campaign ID: `2026-09-15T09-07-59.723Z-334865d-dirty`
- Source revision: `334865d-dirty`
- Suite version: `1.0.0`
- Repetitions per mode/profile cell: 1
- Comparative claims permitted: no

## Healthy Controls

| Mode | Duration (ms) | Health stable | Monitor trials | Action executions | Passed |
|---|---:|---:|---:|---:|---:|
| baseline | 30000 | true | 0 | 0 | true |
| agent | 30000 | true | 0 | 0 | true |

## Fault-Injection Runs

| Mode | Batch ID | Runs | Valid | Invalid | Verified | Automatic | Disagreements | Safety maintained | Median time to heal (ms) | Model calls | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | `experiment-batch-6a602215-f81e-4a36-9488-ee056ac9a164` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 83000 | 11 | 25996 |
| agent | `experiment-batch-6849d9b1-5ef1-4751-ad9a-b2529833b838` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 89600 | 17 | 34711 |

This campaign validates instrumentation only and does not support comparative performance claims.