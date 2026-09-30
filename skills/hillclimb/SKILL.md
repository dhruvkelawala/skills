---
name: hillclimb
description: Use when the user invokes /hillclimb or wants sustained iterative improvement of one performance metric against a target, with measured keep-or-revert experiments. Use perf for one measured optimization or a baseline; use diagnosing-bugs for an unexplained regression, and forensics for diagnosis without fixes.
---

# Hillclimb

Own the metric and the experiment's integrity. One hypothesis, one change, one measurement, keep or revert. Source inspection cannot establish a win.

Invoke as `/hillclimb <workload, metric, target>` or `/hillclimb resume <decision-log>`. This is a bounded experiment loop, not permission to publish or run forever.

## 1. Agree the experiment

Read project instructions, perf CI/scripts, the target entry point and callers, and a matching `verify-<app>` skill or `EVIDENCE.md` when present. Ground the workload in realistic size, history, state, and concurrency. It must reproduce the complaint; otherwise construct the repro first using `diagnosing-bugs` when available.

Fix one metric, units, better direction, correctness invariants, and a stop predicate that pairs a target with a minimum attempt count. Use the user's numbers; otherwise propose 10% improvement and at least 10 completed attempts and agree them before changing code. Also agree a maximum attempt/time budget so unattended work is bounded. Baseline discovery can proceed while target agreement is pending.

Record source SHA, dirty state, runtime/tool versions, machine, inputs/seed, and cache policy. Preserve unrelated work and select a clean experiment checkout. Keep generated captures local unless publishing is requested.

**Complete when:** the workload reproduces the symptom and the target, attempt floor, hard budget, and correctness gate are explicit. A resume reads the existing log and verifies its last accepted SHA and harness before proceeding.

## 2. Build and freeze the lever

Reuse the project's harness. If none exists, make the smallest runnable harness exercising the real path and reporting the chosen metric. Prove sensitivity using contrasting realistic workloads: the target reproduces the symptom and the easier case separates as expected. Revise a harness that cannot distinguish them, before optimizing.

Prefer the harness's established sampling protocol. Otherwise exclude one steady-state warm-up and measure at least five repetitions, reporting median and range; cold starts use fresh processes without excluded warm-up. Use enough samples to clear noise, naming the calculation and count for p95. Baseline variability sets a conservative acceptance threshold before attempts start.

Use stage timings or profiles to explain the cost: project instrumentation first, native `agent_browser` or permitted agent-browser trace/profiler actions or CDP for browser work, Node `--cpu-prof`/`--heap-prof`, and macOS `sample`/`spindump`/`xctrace` when present. Check available actions/help rather than assuming command syntax. Sampled allocations alone do not prove a leak. `perf` has the longer capture recipe when installed.

Freeze the command, fixture, sampling, environment, and instrumentation outside attempt-owned paths. Record the baseline and a green regression-gate run. If the harness must change later, version it, rebaseline the accepted code, and start a new comparison series; old numbers are not comparable.

**Complete when:** one repeatable command emits a sensitive metric, the baseline clears noise, and the regression gate is green.

## 3. Open the decision log

Default to `.perf/<task>/decision.tsv`. Ensure the directory is ignored with `git check-ignore` before writing; if needed, add only this task directory to the repository's local exclude file located by `git rev-parse --git-path info/exclude`. Commit the log only if the user requests it. A Markdown log with the same fields is also valid.

Use one canonical append-only log, one row per attempt:

```tsv
id	ts	hypothesis	change	before	after	delta	tests	verdict	note	evidence	commit
```

Use ISO timestamps, single-line cells, and paths/links for evidence. Escape tabs/newlines and prefix cells beginning with `=`, `+`, `-`, or `@` with a quote when exporting to spreadsheets. Record the frozen command/environment, target, threshold, budget, and baseline artifact in a companion header note. Read the log before each attempt; append corrections instead of rewriting history. On pickup, add a start note naming the prior run and accepted SHA, so runs remain distinguishable.

**Complete when:** the baseline and experiment contract are recorded in a verified ignored location, and every previous attempt has a verdict or an explicit interrupted state.

## 4. Loop in verified units

For each attempt:

1. Ground a falsifiable hypothesis in the profile and source mechanism, not a generic "try memoizing" idea. Name the predicted movement and behavior risks. Review the prior log to avoid repeating a rejected idea without new evidence.
2. Implement only that hypothesis. When `subagent_spawn` exists, use `research` for profile/source reduction, `advisor` for tradeoffs, `implement-cheap` for mechanical edits, `implement-smart` for difficult changes, and `review` for the candidate diff. Supply pointers, owned paths, frozen harness, gate, and stop conditions. Omit `model` for role defaults; overrides use `provider/modelId`. Results arrive automatically; keep doing independent work rather than immediately waiting/polling. Review the real diff and artifacts yourself. Without subagents, do the same work locally. Parallel candidates get separate worktrees from the same accepted SHA; serialize timed runs and evaluate each independently before integrating.
3. Measure the accepted state and candidate with the frozen harness, then run the correctness gate. Alternate batches if machine drift matters. Report before/after numbers, variability, absolute delta, and percent improvement (`100 * (before - after) / before` for lower-is-better, reversed for higher-is-better; undefined for zero baseline).
4. Keep only improvement beyond the predeclared noise threshold with preserved behavior and justified complexity. Otherwise revert the attempt in full, restricted to owned changes; preserve unrelated work. Wrong-surface, failed gate, and inconclusive numbers are rejections. Confirm the restored gate before continuing.
5. Commit each accepted win separately with a conventional subject and explicit staged paths. Log kept/reverted verdict, tests, artifact paths, and accepted SHA either way. An interrupted attempt is not a completed iteration; finish or revert it on resume before another change.

Every attempt ends verified before the next begins. Never stack unmeasured tweaks or modify the acceptance harness to make a candidate pass. A faster result that breaks correctness is reverted, even under deadline pressure.

**Complete when:** every completed attempt has comparable evidence, a gate result, a logged verdict, and either one accepted commit or a verified revert.

## 5. Stop and verify

After several rejects, pivot strategy, reread the hot path, or test a combination of near-misses as one new hypothesis. Correctness and simplicity outrank the number. An independently useful simplification with unchanged performance may be recorded separately as a neutral result; it is not a performance win.

Stop when target and attempt floor are both met, the hard budget is exhausted, or remaining ideas cost more than their likely value. Surface a stall with its evidence; leave cheap untried hypotheses explicit. Keep the original predicate unchanged and distinguish **target met**, **budget exhausted**, and **stalled**.

Run `/verify` in full mode at final HEAD, or discover and run all project-defined checks locally if that skill is unavailable. Report each passed, failed, or could-not-run. Remove temporary probes and audit this run's log against actual commands, artifacts, and commits; supersede inaccurate rows. If available, use a `review` subagent for this evidence audit, preferably a different model family; otherwise disclose self-review. No push or PR without a separate request.

**Complete when:** final metric and correctness results are measured at the accepted HEAD, all attempts are accounted for, and the stop reason and evidence-audit limits are explicit.

## Report

```md
Hillclimb result:
- Workload, metric, target + attempt floor, hard budget, and stop reason:
- Baseline → final: <values, units, variability, percent improvement>
- Attempts: <completed, kept, reverted, interrupted>; accepted fixes and SHAs
- Reproduce/evidence: <frozen command, environment note, log and artifact paths, full verification>
- Attention: <audit reviewer or self-review, risks, tradeoffs, best next hypothesis>
```

## Attribution

Upstream license and copyright notice: [LICENSE](LICENSE).

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@fae2c6e.
