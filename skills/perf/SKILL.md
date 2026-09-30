---
name: perf
description: Use when the user invokes /perf, wants a reproducible performance baseline, or asks to optimize a measured slow path with before/after evidence. For general bug diagnosis or an unexplained regression, start with diagnosing-bugs; for diagnosis without fixes use forensics; for sustained metric optimization use hillclimb.
---

# Perf

Own the measurement story for one performance issue. Measure the real path before changing it; source inspection is not evidence of a win.

Invoke as `/perf <workload or slow path>` or `/perf baseline <path>` for steps 1–2 only, with no implementation or commits. This skill adds baselines and profiling to `diagnosing-bugs`, not a second bug-fix process. If the symptom is unexplained, load that skill by name first and use these steps for its performance branch. If it is unavailable, reproduce the exact symptom with one runnable command before hypothesizing.

## 1. Pin the workload

Read project instructions, the perf CI workflow, package scripts, and the relevant entry point and callers. Prefer the project's perf harness over a new benchmark. Read a matching `verify-<app>` skill or `EVIDENCE.md` when present for launch, drive, and capture instructions; keep captures local unless publishing is requested.

Name the measured surface, realistic input dimensions (size, history, state, concurrency), metric, units, direction, and budget if one exists. Distinguish total work from interactive latency, and synthetic coverage from real-user coverage. Record the source SHA, dirty state, runtime/tool versions, machine, seed/fixture, setup, and cache/warm-up policy. Preserve unrelated work; use a scratch copy when the harness writes reports into the project.

**Complete when:** one exact command exercises the named path and emits the metric, and its scope and omissions are recorded.

## 2. Capture the baseline

Run the unmodified workload and save its output plus a trace/profile that explains where time or memory goes. If the harness already emits stage timings, those are a baseline artifact; obtain a deeper profile before a fix when they do not isolate the mechanism. Choose available tools in this order:

- Project harness and matching surface capture instructions.
- Browser: native `agent_browser` when available. Discover its supported trace/profiler/record/vitals actions; a recording or vitals summary alone is not CPU attribution. Use agent-browser's CLI only when the project permits it and the tool lacks the needed capture, checking local `--help` for syntax. Otherwise use Chrome DevTools Protocol (CDP) Performance/Profiler/Tracing.
- Node: `node --cpu-prof --cpu-prof-dir=<artifact-dir> <entry>` for CPU or `node --heap-prof --heap-prof-dir=<artifact-dir> <entry>` for sampled allocations. An allocation profile is not a retained-heap/leak proof; use an inspector heap snapshot for retainers.
- macOS: `sample`, `spindump`, or Instruments `xctrace` when installed and attachment is permitted. Check local help and record PID, duration, and template.

Keep the harness's established sampling protocol. Otherwise use one excluded warm-up for steady-state work, then at least five measured repetitions; cold-start metrics use a fresh process each time, without warming away the cost. Report median and range, and p95 only with its sample count and calculation. Increase repetitions when variation obscures the signal. Freeze inputs, instrumentation, machine conditions, and command for the comparison. Redact secrets in outputs and treat artifacts as potentially sensitive.

**Complete when:** baseline number, variability, command, environment, and readable artifact paths exist. Wrong-surface, missing signal, or unstable measurements are **inconclusive**, not a pass. Baseline-only mode reports here and stops.

## 3. Test one hypothesis

Trace the measured cost to its source mechanism and all relevant callers. State a falsifiable prediction and the smallest change that could test it. Use these families only when evidence supports them:

- **Eliminate or defer:** unused work can disappear; work not needed yet can wait. Confirm consumers and behavior in source, since a trace cannot prove deletability.
- **Divide or index:** input-size cost calls for pruning, partitioning, parallel independent work, or a cheaper lookup. Include the extra coordination/index cost.
- **Cache or batch:** repeated identical inputs or fixed per-operation overhead. Name cache invalidation and measure realistic hit/miss rates, or bound batch size and delay.
- **Schedule:** necessary work blocks the interactive moment. Measure that latency and any displaced cost, not just total throughput.
- **Redundancy:** a slow wait dominates and spare capacity exists. Measure added resource load before accepting hedged or replicated work.

For a boundary-crossing change, settle ownership and correctness invariants before implementation. Keep one attempt in flight on the acceptance branch. Freeze the acceptance harness outside the attempt's write scope.

When available, use `subagent_spawn` with `role: "research"` for source/profile reduction, `"advisor"` for design tradeoffs, `"implement-cheap"` for bounded mechanical changes, `"implement-smart"` for difficult changes, and `"review"` for the diff. Give file pointers, scope, prediction, frozen measurement command, regression gate, and stop conditions. Omit `model` to use role defaults; an explicit override is `provider/modelId`. Results arrive automatically; continue independent work instead of immediately waiting or polling. Review the actual diff and artifacts yourself. Without subagents, perform the same bounded steps locally.

**Complete when:** one scoped candidate implements the prediction and its diff has been reviewed, without unmeasured follow-on changes.

## 4. Accept or revert

Rerun the identical harness and capture a comparable post-change artifact. Alternate baseline/candidate batches in isolated checkouts if machine drift could explain the delta. Parse large artifacts into a queryable summary (existing viewer, a small script, or SQLite) instead of eyeballing raw JSON. Cite hot frames/stages and source locations; use `forensics trace` for deeper attribution.

Report before/after values, absolute delta, and percent improvement: lower-is-better uses `100 * (before - after) / before`; higher-is-better reverses the numerator. A zero baseline has no defined percent delta. Require improvement beyond the observed noise and a green correctness gate at the real behavior seam. Rerun the original workload, including cache misses and boundary cases the change affects.

Accept only a measured win with preserved behavior and justified complexity. Revert rejected or inconclusive attempt changes in full, touching only attempt-owned files; preserve unrelated work. Restore a verified state before another hypothesis. One conventional commit per accepted win, staging explicit paths. Remove temporary probes. Run `/verify` in full mode at final HEAD; if unavailable, discover and run the project's documented checks and report every result. A missing check is **could-not-run**, not green. Commit locally; pushing or opening a PR requires a separate request.

**Complete when:** every attempt is accepted and committed or fully reverted, full verification is recorded, and the artifacts support the claimed result. If blocked, report the blocker instead of claiming completion.

## Report

```md
Perf result:
- Workload, metric, budget, source SHA, and environment:
- Reproduce: <exact command, setup, warm-up, repetitions>
- Baseline → after: <values, units, variability, absolute and percent delta; or baseline only>
- Evidence: <before/after artifacts, source mechanism, verification results>
- Outcome: <accepted commit or reverted/inconclusive>; tradeoffs and uncovered surfaces
```

## Attribution

Upstream license and copyright notice: [LICENSE](LICENSE).

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
