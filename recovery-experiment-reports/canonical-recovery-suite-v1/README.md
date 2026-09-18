# Canonical recovery experiment evidence

These exports retain frozen campaign configuration, healthy controls, batch-level JSON, run-level CSV and generated summaries. Source revisions identify the code used at execution time, not the later commit that archives the evidence. No new experiment was executed while curating this index.

## Final V1/V2 comparison evidence

| Campaign | Agent identity in frozen manifest | Status and use |
| --- | --- | --- |
| [2026-09-15T10-33-08.363Z-253af28](benchmark/2026-09-15T10-33-08.363Z-253af28/suite-manifest.json) | V1; implementation/prompt 1.0.0 | Final benchmark: 15 baseline and 15 agent trials, five per canonical fault profile. |
| [2026-09-15T11-44-01.538Z-253af28](benchmark/2026-09-15T11-44-01.538Z-253af28/suite-manifest.json) | V2; implementation/prompt 2.0.0 | Final benchmark: 15 baseline and 15 agent trials, five per canonical fault profile. |

Both campaigns use source revision `253af28`; all 60 exported trials are valid and independently verified recoveries. The campaigns were sequential, with separate baseline batches, not randomized simultaneous V1/V2 pairs. Do not infer a causal speedup from similar agent healing medians: baseline timing also differed between campaigns. Model invocation totals include other provider-backed stages; baseline mode is not a zero-model-call system.

Detailed analysis and provenance are maintained in the separate Systems Engineer research workspace at `dissertation/experiments/work-done/week-13/milestone-8-agent-v2-tool-calling-recovery-orchestrator/04-benchmark-evaluation.md`. This repository retains the exported evidence supporting that analysis.

## Validation and excluded preliminary evidence

Validation has one repetition per fault profile and does not support comparative claims. Preliminary exports remain unchanged as an audit trail, not substitutes for final benchmark observations.

| Validation campaign | Classification | Permitted interpretation |
| --- | --- | --- |
| `2026-09-15T08-44-18.259Z-334865d` | Incomplete concurrent-run attempt; only a baseline healthy-control export remains, no suite manifest or trial batch | Diagnostic record only. The user reported the active-controlled-experiment lock prevented execution; the retained file alone is not a completed recovery experiment. |
| `2026-09-15T08-44-37.159Z-334865d` | Pre-Milestone-8-merge validation; agent version absent from suite manifest | Not verified Agent V2 evidence, regardless of the shell setting used to launch it. Excluded from final V1/V2 comparisons. |
| `2026-09-15T09-07-59.723Z-334865d-dirty` | Dirty-tree, pre-merge validation; agent version absent from suite manifest | Exact implementation identity cannot be reconstructed from the revision label alone. Diagnostic only; excluded from final comparisons. |
| `2026-09-15T09-40-36.881Z-253af28` | Post-merge V1 validation; identity frozen in manifest | V1 validation, not final comparative benchmark. |
| `2026-09-15T09-59-19.275Z-253af28` | Post-merge V2 validation; identity frozen in manifest | V2 validation, not final comparative benchmark. |

The older August benchmark retains its adjacent [ERRATA.md](benchmark/2026-08-21T05-59-20.379Z-565cd28/ERRATA.md). Do not mix its superseded timing definition with the September comparison. The older dirty August validation is likewise historical, not part of the final V1/V2 evidence set.

## Publication boundaries

Commit curated, sanitized manifests, run-level exports, summaries, corrections and methodology. Do not commit secrets, private configuration, database dumps, unrestricted operational logs or large redundant generated artefacts. Keep `.agents/milestones/active.md` ignored and local; historical milestone archives are durable repository records.

Raw exports in these campaigns have not been rewritten to improve outcomes, manufacture identity or conceal incomplete/invalid provenance. Preserve failures and exclusions visibly in subsequent campaigns.
