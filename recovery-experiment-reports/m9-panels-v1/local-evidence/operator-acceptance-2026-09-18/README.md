# Operator acceptance — 18 September 2026

These are bounded local acceptance observations, **not the final comparative campaigns or dissertation results**. Earlier canonical reports are unchanged. Synthetic work orders and the existing local Docker/OpenAI configuration were used. No private configuration or provider conversations are included.

## Observed outcomes

| Check | Evidence and result |
| --- | --- |
| Dashboard-launched V2 recovery | `operator-run-ddb085ca-767d-4b8a-ba7e-33e7dde505d1`, trial `trial-85deb938-56f9-4b1a-908c-7b84a4125315`: one registered restart, safety passed, resolved safely, independent oracle passed, restoration verified and lock released. Reposting the same request UUID returned the same run without another fault. |
| Cold/warm reuse | `reuse-smoke-results/`: both observations valid with verified recovery/restoration. Cold had empty membership and generated a plan. Warm exposed only the verified paired cold trial, adopted its plan through fresh diagnosis/plan/decision records, and retained source provenance. |
| Unsupported fault | `unsupported-smoke-results/`: valid escalation-oracle success; attention recorded, zero unsuitable effects and zero retrials. Healing time remains null. Restoration verified. |
| Attention review | `attention-c9bb0b40-66ea-4873-9858-e29c840c5af0`: acknowledgement while unhealthy did not release the hold. Review followed verified restoration; the hold was released by a deterministic healthy monitor observation before review. Historical outcome stayed escalated. Empty notes were rejected; an interrupted review retained the draft. Automated integration tests additionally cover review during an active hold. |
| Healthy workload calibration | `calibration.json`: 150 offered/achieved/successful requests, no errors/timeouts/capacity skips; configured 5 requests/second, concurrency 4. |
| Non-idle recovery | `non-idle-smoke-results/`: valid verified recovery/restoration. All 541 samples retained: 214 successful, 327 errors during the deliberate outage, zero timeouts/capacity skips. Warm-up 51/51, verification 57/57 and the exact ten-second post-recovery window 50/50 succeeded. This was not an error-free overall run. |

Warm provenance: source trial `trial-d1c9ab79-8ba7-449f-9957-7a57840448f0`, source plan `recovery-plan-933584b3-cc0f-409a-85df-143eca58daa4`, fresh adopted plan `recovery-plan-148705cd-d6ce-4eb8-be67-15507e7080d8`. Source membership and stage measurements are reconstructable in the exports.

## Revision and configuration integrity

Dashboard recovery, calibration and reuse ran at `ac601e9055659dab374ba37614ba5b62f01b71a6`; unsupported escalation at `e290dee1573ee40418e9851464f8542b490c5ea0`; non-idle recovery at `ae4b08f420e948293f8e6867ff06eda789d866c3`. These are deliberately separate acceptance revisions, not one frozen benchmark revision. Final campaigns must use one clean merged revision.

The exported configuration records the actual model `gpt-4.1-mini`, 30-second monitor interval, unhealthy threshold 2 and 15-second cooldown. Do not substitute documented defaults for those recorded values. The prospective manifests, fixture, isolation preflight, raw workload samples and calibration are retained alongside the batch reports.

Two procedural false starts produced no accepted observation: calibration was attempted during an active controlled outage, then repeated after restoration; reuse execution initially failed monitor-mode preflight before injection, then was run with the documented runner-process override. No failed accepted observation was removed or replaced.

## Implementation review and verification

- Execution still goes through ActionService, SafetyService and registered argument-based handlers; the model cannot supply commands. Three action invocations and bounded agent turns remain enforced. Deterministic healthy evidence authorizes completion; mandatory safety escalation cannot be overridden.
- HTTP mutations require the guarded local origin/host/custom header. Reads also reject foreign hosts. Dashboard and database ports bind to loopback. Docker build context excludes private environment files and evidence. This is a local privileged prototype, not an authenticated public deployment.
- Durable request reconciliation, graceful runner draining, fresh health readiness, experiment paths, plan-source provenance, API timeouts, sanitized errors, stale-read handling and latest-request-wins polling were corrected. Detail navigation and mobile record layouts were corrected without a redesign.
- Full managing-system validation passed: 107 unit tests, seven integration tests, type checking, lint/format checks and production build. Dashboard: six tests, lint and production build. Managed-system formatting/build and GitHub checks passed at the reviewed code heads.
- Real Chromium checks exercised launch/reconciliation, attention validation and interrupted submission, stale/failed reads, native mobile menu Escape/focus restoration and detail navigation. Five overview pages and four detail views were checked at 1440, 1280 and 390 pixels; final production detail checks reported no horizontal overflow or uncaught page errors. Screenshots are supporting interface evidence, not outcome measurements.
- `ui-audit.json` records the scoped UI audit, applied findings and deferred checks. Its UI readiness verdict does not certify backend security or public deployment.

Final clean-image smoke: `3bf42833094cdbc481a3f3e780466d5ebea5ba5f`. The recorded build identity matched that clean checkout; all exposed Compose ports were loopback-only, current evidence was healthy and no controlled run was active. `system-desktop.png` (1440px) and `warm-trial-mobile.png` (390px) were captured from that production image, not fabricated design mockups. Later evidence-only commits do not change its executable code; the final merged revision must still be rebuilt and recorded before campaigns.

## Limitations and cleanup

One cold/warm pair, one unsupported observation and one workload observation cannot establish superiority, statistical significance or production capacity. Full prospective campaigns remain outstanding. Safari, human screen-reader testing, formal axe-core testing and measured cumulative layout shift were not completed.

Backend locked dependencies still report eight advisory entries (one moderate, seven high), primarily Prisma tooling transitives. A compatible fast-uri patch was applied; no forced major Prisma downgrade was performed. Public deployment is not approved, and dependency remediation remains follow-up work.

The ten owned synthetic smoke work orders were removed through ownership-checked cleanup after exports were preserved. The disposable automated-test PostgreSQL container was removed. Runtime/history database volumes and historical trials were preserved. Recreate a fresh fixture for final campaigns; this historical fixture is evidence, not permission to reuse deleted records.
