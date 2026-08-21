# Recovery Experiment Reports

This directory stores immutable exported evidence from controlled recovery experiments.

## Structure

- `pilot/`: instrumentation and workflow-validation runs that do not support comparative claims;
- `canonical-recovery-suite-v1/validation/`: one healthy control per mode and one repetition of every recovery-mode and fault-profile cell;
- `canonical-recovery-suite-v1/benchmark/`: one healthy control per mode and five repetitions of every fault-profile cell for the initial descriptive benchmark.

Each canonical campaign contains the original per-mode batch exports, `suite-manifest.json` and `suite-summary.md`. Do not rewrite an earlier campaign after changing the implementation. Run a new campaign under the new source revision instead.

Run the validation campaign from the repository root:

```text
npm --prefix managing-system run experiment:suite -- --phase validation
```

After validation passes without instrumentation defects, run the benchmark:

```text
npm --prefix managing-system run experiment:suite -- --phase benchmark
```
