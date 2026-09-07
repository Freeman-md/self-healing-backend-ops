# canonical-recovery-suite-v1 benchmark

- Campaign ID: `2026-08-21T05-59-20.379Z-565cd28`
- Source revision: `565cd28`
- Suite version: `1.0.0`
- Repetitions per mode/profile cell: 5
- Comparative claims permitted: yes

## Healthy Controls

| Mode | Duration (ms) | Health stable | Monitor trials | Action executions | Passed |
|---|---:|---:|---:|---:|---:|
| baseline | 30000 | true | 0 | 0 | true |
| agent | 30000 | true | 0 | 0 | true |

## Fault-Injection Runs

| Mode | Batch ID | Runs | Valid | Invalid | Verified | Automatic | Disagreements | Safety maintained | Median time to heal (ms) | Model calls | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | `experiment-batch-5cc8e026-0edd-4559-b2e0-359b8464f44b` | 15 | 15 | 0 | 15 | 15 | 0 | 15 | 99463 | 55 | 131375 |
| agent | `experiment-batch-cee7c975-85a9-4da6-8891-aa6823bcb01f` | 15 | 15 | 0 | 15 | 15 | 0 | 15 | 109908 | 85 | 169698 |

This campaign is the initial descriptive benchmark defined by canonical-recovery-suite-v1.