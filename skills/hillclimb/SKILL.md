---
name: hillclimb
description: Use for /hillclimb, or a request to keep improving one score toward a target, such as speed, a critic or eval score, a pass rate, or a size. Makes one change per attempt, keeps or reverts it, and logs every attempt. `/hillclimb resume` continues from the log. For one slow path use perf.
---

# Hillclimb

Raise one score toward a target in small measured attempts. Each attempt makes one change, scores it, and keeps or reverts it before the next one starts.

## 1. Set up and start

Take the thing to improve, the score, the target, the budget, and the gate from the request. A bare `/hillclimb` works on the thing discussed last. Fill any gap with a default:

- Score: what the user named. Otherwise runtime for a slow path, pass rate for a flaky suite, or a critic's 0 to 10 rating for something judged by eye.
- Target: 10% better than the baseline.
- Budget: 10 attempts.
- Gate: the checks that must stay green. These are the project's tests, or for an artifact, that it still builds and renders.

Post the thing, score, target, budget, and gate in one line, then start. The user changes them by replying, so the loop runs without waiting for approval.

Fix the scoring method and use it for every attempt:

- A measured score, such as time, size, pass rate, or an eval, comes from one command. For a performance score, load the perf skill, answer its benchmark checklist for this command before you rely on it, and try ideas in its cheapest-first order.
- A taste score comes from a critic: a helper with the `review` role (see Helpers) that did not make the change and scores the artifact against a short written rubric. The user is the final judge, as step 3 explains.

Score the baseline 3 times, or 5 times for timings, and note the median and the range. An attempt counts as better only when it beats the best kept score by more than that range.

Open the log at `.hillclimb/<task>/log.tsv`. Add `.hillclimb/` to the file that `git rev-parse --git-path info/exclude` names, so git ignores it. Write one row per attempt:

```tsv
id	hypothesis	change	before	after	verdict	judge	commit	note
```

**Done when** the one-line setup is posted, the baseline has a median and a range, the gate is green, and the log has a baseline row.

## 2. Loop

For each attempt:

1. Read the log, then pick one idea that names a cause you measured or saw, such as "the chin looks flat because the light comes from straight ahead". Skip ideas the log already rejected unless you have new evidence.
2. Make that one change. Hand it to an `implement-cheap` helper, or an `implement-smart` helper for a hard change (see Helpers), and read the diff.
3. Score it with the same method and run the gate.
4. Keep it when it beats the best kept score by more than the range, the gate is green, and the gain is worth any added complexity. Commit only its files. Otherwise revert it in full.
5. Log the row, kept or reverted.

After three rejects in a row, change approach: reread the code or the artifact, try a bolder idea, or combine two near misses into one attempt. When the user steers mid-loop, for example "keep it simple but better looking", log the steer as a note, apply it to every later idea, and keep going.

**Done when** every attempt has a logged verdict and either a commit or a full revert.

## 3. Checkpoints for taste scores

When a critic gives the score, the user judges at checkpoints: after the baseline, after every third attempt, when the critic's score first reaches the target, and at the end. At each checkpoint, show the best kept version as a screenshot, a rendered page, or a link, with the critic's score, and keep working while you wait.

The user's score overrides the critic's. Log it with judge `user`. When it differs from the critic's by more than one point, give the critic the user's score and words as a calibration example before the next attempt. Count the target as met only on the user's score.

**Done when** every checkpoint has shown the artifact and every score the user gave is in the log.

## 4. Stop and report

Stop when the target is met, the budget is spent, or the remaining ideas cost more than they are likely to gain. Run `/verify`, or the project's checks, at the final commit. Keep the commits local until the user asks to publish.

```md
Hillclimb: <score> <baseline> to <final>, target <target>. Stopped: <target met | budget spent | stalled>.
Attempts: <n> run, <k> kept. Kept: <one line per change, with its commit>.
Log: <path>. Next idea: <the best one left>.
```

For a taste score, show the final artifact with both the critic's and the user's score.

**Done when** the report is posted, you measured the final score at the last commit, and every attempt is in the log.

## Resume

`/hillclimb resume` reads the log, checks that the last kept commit is HEAD, finishes or reverts any half-done attempt, and continues at step 2.

## Helpers

Hand work to a helper agent with the named role: on Pi or SumoCode spawn that role; in Claude Code use the Agent tool (general-purpose, model `sonnet` for cheap work); in Codex use the standard subagent. With no helper available, do it yourself and say so.

## Attribution

Adapted from pstack by Lauren Tan (MIT), cursor/plugins@e5a8186. Upstream license: [LICENSE](LICENSE).
