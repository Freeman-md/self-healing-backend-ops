# canonical-recovery-suite-v1 validation

- Campaign ID: `2026-09-15T08-44-37.159Z-334865d`
- Source revision: `334865d`
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
| baseline | `experiment-batch-4621244f-f391-42ee-b660-7773ae10cd37` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 86106 | 11 | 25963 |
| agent | `experiment-batch-71e4e6d3-61c8-4b67-831e-1fef17f721d7` | 3 | 3 | 0 | 3 | 3 | 0 | 3 | 93269 | 17 | 33958 |

This campaign validates instrumentation only and does not support comparative performance claims.