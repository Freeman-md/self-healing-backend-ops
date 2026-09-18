# canonical-recovery-suite-v1 benchmark

- Campaign ID: `2026-09-15T10-33-08.363Z-253af28`
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
| agent | v1 | 1.0.0 | 1.0.0 |

## Fault-Injection Runs

| Mode | Batch ID | Runs | Valid | Invalid | Verified | Automatic | Disagreements | Safety maintained | Median time to heal (ms) | Model calls | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | `experiment-batch-233ccb34-e36b-4f07-9a52-b3a373c1a429` | 15 | 15 | 0 | 15 | 15 | 0 | 15 | 85604 | 55 | 130788 |
| agent | `experiment-batch-70c377ea-1a29-4356-8d9f-124238e6e749` | 15 | 15 | 0 | 15 | 15 | 0 | 15 | 92111 | 85 | 170692 |

This campaign is the initial descriptive benchmark defined by canonical-recovery-suite-v1.