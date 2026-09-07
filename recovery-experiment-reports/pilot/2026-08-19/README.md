# 2026-08-19 Instrumentation Pilots

These exports verify that controlled fault injection, monitor-triggered trial correlation, deterministic recovery verification and report generation operated end to end before the canonical experiment protocol was frozen.

| Mode | Batch | Runs | Valid | Purpose |
|---|---|---:|---:|---|
| Baseline | `experiment-batch-352fd71b-07df-411f-9c14-29c76ee56bcd` | 1 | 1 | Single-run smoke verification |
| Agent | `experiment-batch-4e5a5fb8-5a53-461c-ba58-a6f7131f8efb` | 6 | 6 | Three profiles with two repetitions each |

Both batches used source revision `33d4da9` and measurement version `1.0.0`. The unequal run counts and profile coverage mean the batches must not be used to claim comparative performance. They are retained as developmental evidence and are not part of `canonical-recovery-suite-v1`.
