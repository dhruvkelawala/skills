---
name: perf
description: Use when something is slow ("why so slow", "still slow") or on /perf. Measures the slow path, names the limiter, makes one fix, and measures again. `/perf baseline` only measures. `/perf diagnose`, or a shared CPU profile, trace, heap snapshot, or spindump, explains the cause without changing code.
---

# Perf

Make one slow thing faster and prove it with numbers. The limiter is the stage that takes most of the time. The whole gets faster only when the limiter does. Every report gives one number and names the limiter.

- `/perf <slow thing>`, or "why so slow": steps 1 to 4.
- `/perf baseline <thing>`: steps 1 and 2, then report. Change no code.
- `/perf diagnose <process or artifact>`, or a shared profile or trace file: the read-only diagnose mode below.

A bare `/perf` targets the thing the user last called slow.

For repeated attempts against a target score, use hillclimb. For wrong behaviour rather than slowness, use diagnosing-bugs.

## 1. Pin the workload

Find one command or one user action that shows the slowness on the real path, with realistic data size and concurrency. Prefer the project's own benchmark or perf script. A `verify-<app>` skill or an `EVIDENCE.md` says how to launch and drive the app. Write down the claim you expect to make, for example "search p50 drops from 2.4 s to 0.8 s on the 60k-row dataset". The target is the user's number; with none, it is halving the limiter's time.

**Done when** one exact command reproduces the slowness and prints a number with its unit.

## 2. Measure and name the limiter

Run the command 5 times and take the median and the range. For steady-state work, discard one warm-up run first; for a cold start, use a fresh process each time. Then split the time into stages, such as network, database, model call, parsing, and render, using the project's own timings or temporary timers. Profile in a separate run that you do not report, because profilers slow the work down: `node --cpu-prof`, `py-spy`, macOS `sample`, or a browser trace through the host's browser tool or the Chrome DevTools Protocol.

Name the limiter from the stage timings. In one real case the agent first blamed model latency, the user came back with "still extremely slow", and stage timings then showed the time going to database round trips of 156 ms each.

**Done when** you have a baseline median with its range and one stage named as the limiter, with its share of the total. `/perf baseline` reports here.

## 3. Make one fix, cheapest first

Go down this list in order and pick the first item that can meet the target:

1. Don't do it. Remove work whose result nothing uses.
2. Don't do it again. Reuse or cache a result you already computed.
3. Do it less. Batch, paginate, or shrink the input.
4. Do it later. Move work off the path the user waits on.
5. Do it when they're not looking. Run it in idle time or the background.
6. Do it concurrently. Run independent work in parallel.
7. Do it cheaper. Use a faster algorithm, query, or library.

Before you remove work, confirm in the source that nothing reads its result. Before you add a cache, name what invalidates it. Make one change. Hand a hard change to an `implement-smart` helper and a mechanical one to an `implement-cheap` helper (see Helpers), and read the diff yourself.

**Done when** one change for one item exists and you have read its diff.

## 4. Measure again, then keep or revert

Run the same command on the old and new code, alternating A, B, A, B until each side has 5 runs, and run the tests. Keep the change when the gap is larger than the run-to-run range and the tests pass, and commit it locally with only the files you changed. Otherwise revert it in full. If the target is still out of reach, name the next item worth trying. Then answer the checklist below.

**Done when** the change is committed or reverted, the tests have run, and every checklist question has an answer.

## Before you report a number

Answer each question from a run, not from reading code:

1. Why not double? Name the limiter. If a change did not move the number, the limiter explains why.
2. Was it tuned? Both sides ran as production runs them: release build, real flags, and caches as warm or cold as production sees them.
3. Did it break limits? Compare the result with disk and network bandwidth and the number of cores. Removing a stage that takes 10% of the time makes the whole at most about 11% faster.
4. Did it error? Count failures and check that outputs are correct. Errors are often fast.
5. Does it reproduce? At least 5 alternating runs per side, reported as a median and a range. A gap smaller than the range means no measurable difference.
6. Does it matter end to end? Measure the path the user waits on, and report a micro result as a share of it.
7. Did the work happen? Confirm that the timed region did the real work: the request arrived, the rows were written, the result was used.

Call the result inconclusive when you cannot name the limiter, when a side ran untuned, or when questions 4 or 7 have no answer, and say which.

## Report

```md
<metric>: <before> to <after> (median of 5 per side, range <low> to <high>). Limiter: <stage and cause, path:line>.
Fix: <list item and the one-line change>, commit <sha>. Or: reverted, because <reason>.
Command: <exact command>. Tests: <passed | failed | could not run>.
```

A baseline report is one line: the metric with its median and range, the limiter, and the command.

## Diagnose mode

Diagnose mode reads and measures only. It changes no product code and commits nothing. Read [references/diagnose.md](references/diagnose.md) for capture tools, artifact formats, and how to narrow each kind of signal.

1. Get the signal. With a supplied artifact, work from it as it is and leave the original untouched. Without one, reproduce the symptom on the live process and capture the smallest artifact that shows it. Ask before attaching to a shared or production process. **Done when** you have a readable artifact and have recorded the capture command and window.
2. Reduce it to a ranked finding: the hot path, the chain that keeps memory alive, or the blocked thread. Hand a large artifact to a `research` helper (see Helpers). **Done when** the finding has units and a query or script you can rerun.
3. Map the finding to source: file, symbol, and line at the revision that produced the artifact. **Done when** each finding has a `path:line` or is marked unresolved with the reason.
4. Rate it: confirmed, when a live probe or a paired before-and-after capture agrees; supported hypothesis; or inconclusive. **Done when** the report states the rating and the next check that would settle it.

Report the signal with its units, the source location, the rating, and the artifact paths. Offer the fix as `/perf <slow thing>`.

## Helpers

Hand work to a helper agent with the named role: on Pi or SumoCode spawn that role; in Claude Code use the Agent tool (general-purpose, model `sonnet` for cheap work); in Codex use the standard subagent. With no helper available, do it yourself and say so.

## Attribution

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@e5a8186: the perf-issue, benchmark-checklist, runtime-forensics, and trace-forensics material. Diagnose mode replaces the former `forensics` skill. Upstream license: [LICENSE](LICENSE).
