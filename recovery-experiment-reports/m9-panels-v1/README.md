# Milestone 9 prepared protocols

These are prepared procedures, not observed results. Live Docker/OpenAI checks and all final campaigns remain human tasks. Preserve earlier canonical reports. Use a disposable local Compose testbed with synthetic work orders only.

## Runtime and tests

From the repository root, supply private configuration through the existing approved mechanism. Do not print environment values. Install locked dependencies with `npm --prefix managing-system ci`, then run the following from `managing-system/` with **DATABASE_URL pointing at a disposable test database**. Integration tests truncate their database; never use the runtime/history database.

```sh
DOTENV_CONFIG_PATH=/dev/null npm run prisma:migrate:deploy
DOTENV_CONFIG_PATH=/dev/null npm run test:types
DOTENV_CONFIG_PATH=/dev/null npm test
DOTENV_CONFIG_PATH=/dev/null npm run build
```

Start the local testbed and monitor from the exact approved revision. Require a clean checkout before stamping the image; never claim a dirty checkout is the recorded commit:

```sh
M9_REVISION=$(git rev-parse HEAD)
test -z "$(git status --porcelain)" || exit 1
SOURCE_REVISION="$M9_REVISION" RECOVERY_MODE=agent AGENT_STRATEGY_VERSION=v2 docker compose up -d --build
```

Retrieval defaults off. `HISTORICAL_RETRIEVAL_ENABLED=true` enables V2 2.1.0/prompt 2.1.0; off retains V2 2.0.0/prompt 2.0.0 and eight turns. Enabled uses twelve turns. Both permit at most three ActionService invocations. `RECOVERY_SOURCE_TRIAL_IDS` is a JSON allowlist (maximum 100 unique IDs), default `[]`. Empty means cold, not deletion. Change `RECOVERY_TARGET_CONFIGURATION_ID` whenever the managed deployment configuration changes. Fingerprints additionally include target origin, request/action settings, active catalogue, safety rules and shared policy version.

Shared policy `running-unreachable-hold-v1` applies to every strategy: running app + running database + unreachable app escalates before operational effects. Durable unchanged-incident attention suppresses autonomous retrials until deterministic healthy evidence releases holds. These shared policy changes mean comparisons are not identical historical binaries.

## Fixture and calibration

Run commands below inside the managing container so the fixture's base URL matches the monitor. `/managing-system/experiment-output/m9` is the existing experiment-output volume. The fixture creates exactly ten work orders with a unique ownership marker, persists IDs after each creation and reads individual `/work-orders/:id` responses. Cleanup verifies each marker before deleting only those IDs. Keep partial fixture files after errors; do not delete by title or clear unrelated tables.

```sh
docker exec managing-system-app mkdir -p /managing-system/experiment-output/m9
docker exec managing-system-app npm run experiment:workload -- --operation setup --base-url http://managed-system:3000 --file /managing-system/experiment-output/m9/fixture.json
docker cp recovery-experiment-reports/m9-panels-v1/workload-settings.json managing-system-app:/managing-system/experiment-output/m9/load.json
docker exec managing-system-app npm run experiment:workload -- --operation calibrate --file /managing-system/experiment-output/m9/fixture.json --settings /managing-system/experiment-output/m9/load.json --output /managing-system/experiment-output/m9/calibration.json
```

Confirm the actual Compose application port/base URL before setup; the fixture URL must equal `MANAGED_SYSTEM_BASE_URL`. Calibration runs a ten-second warmup followed by thirty seconds of healthy reads. It passes only with all reads successful, no concurrency skips and achieved rate at least 95% of offered rate. Five requests/second is a starting setting, not a measured capacity claim. If calibration fails, choose a lower fixed rate prospectively, save a new settings/calibration file and freeze that setting for both workload conditions. Never tune within a campaign.

Latency summaries include completed errors/timeouts, exclude capacity-skipped offers and use requests **started** in `[windowStart, windowEnd)`. Exports retain every sample, offered/achieved rates and error/timeout/skip counts. Traffic runs continuously across warmup, injection, recovery and post-recovery. The fixed post-recovery interval starts after independent stability/business verification and ends exactly `postRecoveryMs` later. Correlation/oracle time is exported separately as `verification`; delayed persistence does not extend the fixed interval. Failed recovery uses the explicitly labeled `postTermination` interval instead. This single workload establishes neither saturation nor production realism.

## Unsupported preflight

The application must remain running and unreachable with its single validated local Compose bridge attachment removed. The captured container ID, network ID and aliases must remain unchanged. The preflight performs a restart while detached and proves that this does not restore reachability; finally it restores the attachment and verifies a fixture read. Stop the monitor before this isolated preflight. Execute it from the host with a **separate host-addressed fixture**, the existing Docker CLI, and private DATABASE_URL configured for the same managing-system history database. The preflight acquires the existing global controlled-run lock before mutation:

```sh
RECOVERY_MODE=agent docker compose stop managing-system
cd managing-system
npm run experiment:workload -- --operation setup --base-url http://localhost:3004 --file /tmp/m9-host-fixture.json
npx tsx scripts/m9-isolation-preflight.ts --fixture /tmp/m9-host-fixture.json --output /tmp/m9-isolation-preflight.json
cd ..
RECOVERY_MODE=agent AGENT_STRATEGY_VERSION=v2 docker compose up -d managing-system
docker cp /tmp/m9-isolation-preflight.json managing-system-app:/managing-system/experiment-output/m9/isolation-preflight.json
```

A preflight failure is a stop, not permission to relax target checks. Restoration errors retain the captured attachment for operator repair. The panel retains its exclusive database lock until restoration and business/health checks succeed; it does not silently release a failed restoration lock. Review a retained run manifest before repairing the exact attachment and explicitly releasing that run's lock. No automated database-reset or network-prune command is provided.

## Prepare and execute the panels

Freeze `M9_REVISION` to the full approved checkout SHA with `M9_REVISION=$(git rev-parse HEAD)`. Build the managing image from that exact clean checkout with `SOURCE_REVISION="$M9_REVISION"` before any run. The Docker build writes a non-secret revision artifact. Both runner and monitor reject M9 execution if that artifact differs from the requested revision; an unstamped local build is explicitly `unrecorded` and cannot run these panels. The monitor also checks the frozen model, cadence, threshold, cooldown, action/turn bounds and implementation/prompt versions before any strategy or action. Every execution requires a new output directory; failed observations stay recorded and are not replaced or retried. Each condition is run separately with the corresponding monitor version. Run order is deterministic from seed `m9-fixed-2026-09-18`.

For each condition below, set the indicated monitor mode/version before preparation/execution:

| Condition | Mode | Version | Observations |
|---|---|---|---|
| `baseline` | baseline | v2 (ignored) | 3 canonical profiles × 5 |
| `v1` | agent | v1 | 3 canonical profiles × 5 |
| `v2-off` | agent | v2 | 3 canonical profiles × 5, retrieval off |
| `v2-empty` | agent | v2 | 3 canonical profiles × 5, retrieval on, empty membership |
| `reuse` | agent | v2 | 5 isolated application-stopped cold/warm pairs |
| `unsupported` | agent | v2 | 5 isolation trials, escalation oracle |
| `idle` | agent | v2 | 5 application-stopped, retrieval off, same fixture/probes |
| `non-idle` | agent | v2 | 5 application-stopped, retrieval off, calibrated load |

Example commands for `v2-empty`; substitute each table condition and its mode/version, keeping distinct manifest/output paths:

```sh
SOURCE_REVISION="$M9_REVISION" RECOVERY_MODE=agent AGENT_STRATEGY_VERSION=v2 docker compose up -d --build --force-recreate managing-system
docker exec managing-system-app npm run experiment:m9 -- --prepare --condition v2-empty --revision "$M9_REVISION" --fixture /managing-system/experiment-output/m9/fixture.json --manifest /managing-system/experiment-output/m9/v2-empty.json
docker exec managing-system-app npm run experiment:m9 -- --manifest /managing-system/experiment-output/m9/v2-empty.json --output /managing-system/experiment-output/m9/v2-empty-results
```

For `unsupported`, add `--preflight /managing-system/experiment-output/m9/isolation-preflight.json` to preparation. For **both** `idle` and `non-idle`, add `--settings /managing-system/experiment-output/m9/load.json --calibration /managing-system/experiment-output/m9/calibration.json` so windows/fixture/probes agree; only non-idle generates continuous traffic. Do not reuse idle or canonical observations after the fact.

Run-level manifests freeze membership before injection and check the live monitor's mode/version/fingerprint before recovery. Cold always starts with `[]`; warm exposes only that pair's independently verified cold trial. An unverified cold source produces a retained invalid warm observation. No previous historical trials are imported. Cold-before-warm ordering and cache/environment drift limit causal claims: report paired descriptive comparisons, not superiority or significance.

Every batch exports the existing report files, per-run configuration/workload/restoration records and `recovery-stages.json`. Measurement version 2.0.0 records accepted diagnosis persistence completion, plan persistence completion, lookup start/end, generated/retrieved provenance and source IDs. Earlier absent facts remain unavailable, not backfilled. Provider totals and recovery-planning totals are separated; missing token usage remains null. Unsupported oracle success means safe escalation/attention/suppression, never healing, and healing time stays null.

Copy evidence out without changing earlier report folders:

```sh
docker cp managing-system-app:/managing-system/experiment-output/m9/. recovery-experiment-reports/m9-panels-v1/local-evidence/
```

## Attention service and manual acceptance

The public `AttentionService` exposes `listAttention`, `readAttention`, `acknowledgeAttention` and `reviewAttention`. Notes are 1–4000 trimmed characters; transitions are requires_attention → acknowledged → reviewed with application timestamps. There is no fabricated operator identity, HTTP endpoint, approval/resume operation or action authority. Inspection and review use an application service harness with the configured repository; never edit trial outcome to acknowledge a record.

Before final campaigns, inspect a cold/warm pair, a single unsupported trial and a bounded workload observation. Confirm the plan source, copied semantics, fresh IDs, action safety, attention and release evidence. These are live acceptance tasks, not satisfied by mock tests. For bounded smoke, add `--smoke` to the preparation command and use a separate `*-smoke.json` manifest and `*-smoke-results` directory. This prospectively schedules one observation (one cold/warm pair for `reuse`) and records `smoke: true` and one requested repetition. Use `reuse`, `unsupported` and `non-idle` smoke manifests before the full panels. Never interrupt a runner while a fault is active; smoke observations are not substituted into the final five-repetition panels.

Cleanup after exporting evidence:

```sh
docker exec managing-system-app npm run experiment:workload -- --operation cleanup --file /managing-system/experiment-output/m9/fixture.json
cd managing-system
npm run experiment:workload -- --operation cleanup --file /tmp/m9-host-fixture.json
```
