# canonical-recovery-suite-v1 benchmark

- Campaign ID: `2026-09-15T11-44-01.538Z-253af28`
- Source revision: `253af28`
- Suite version: `1.0.0`
- Repetitions per mode/profile cell: 5
- Comparative claims permitted: yes

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
| baseline | `experiment-batch-53aa3bc2-a976-4f74-ac4b-487842ee63f5` | 15 | 15 | 0 | 15 | 15 | 0 | 15 | 79492 | 55 | 130463 |
| agent | `experiment-batch-9de4ac66-c139-4f00-a6cf-c46f4a81fbec` | 15 | 15 | 0 | 15 | 15 | 0 | 15 | 91820 | 124 | 287671 |

This campaign is the initial descriptive benchmark defined by canonical-recovery-suite-v1.