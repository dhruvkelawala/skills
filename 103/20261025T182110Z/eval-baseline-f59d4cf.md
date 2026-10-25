# verification-skill eval: the baseline runs

Each block is the runner's own output, with local paths shortened. The case repos are private, so this page holds no transcript, quote or file from them. The skill under test, everything in `skills/verification-skill/` outside `evals/`, is identical at every commit named here.

## visaroy, runner at `8d527df`

```console
$ node skills/verification-skill/evals/run.mjs visaroy
visaroy: run folder ~/.cache/verification-skill-evals/visaroy-20261025T171634Z, checkout $TMPDIR/verification-skill-eval-rLInSx/checkout
visaroy: create is running
visaroy: grading 11 changed files
visaroy: 7.5 of 19 (39%) at skill 5084b3d. Results in ~/.t3/worktrees/skills/feat-103-verification-skill-eval/skills/verification-skill/evals/results.md
```

## visaroy again, runner at `c9b4fb8`

```console
$ node skills/verification-skill/evals/run.mjs visaroy
visaroy: run folder ~/.cache/verification-skill-evals/visaroy-20261025T174519Z, checkout $TMPDIR/verification-skill-eval-EV18pu/checkout
visaroy: create is running
visaroy: grading 12 changed files
visaroy: 6 of 19 (32%) at skill c9b4fb8, create on claude-opus-5-5, the grade on claude-opus-5-5. Results in ~/.t3/worktrees/skills/feat-103-verification-skill-eval/skills/verification-skill/evals/results.md
```

## lore, runner at `8d527df`: failed after create

Create had linked the new skill folder into `.claude/skills`, and copying create's files threw on the link. `bb50baf` fixed it, with a test whose fake create agent makes the same link.

```console
$ node skills/verification-skill/evals/run.mjs lore
lore: run folder ~/.cache/verification-skill-evals/lore-20261025T171634Z, checkout $TMPDIR/verification-skill-eval-RHYwUV/checkout
lore: create is running
Error: Recursive option not enabled, cannot copy a directory: $TMPDIR/verification-skill-eval-RHYwUV/checkout/.claude/skills/verify-<app>/
    at cpSyncFn (node:internal/fs/cp/cp-sync:56:13)
    ...
```

## lore again, runner at `bb50baf`

```console
$ node skills/verification-skill/evals/run.mjs lore
lore: run folder ~/.cache/verification-skill-evals/lore-20261025T175935Z, checkout $TMPDIR/verification-skill-eval-LekqzC/checkout
lore: create is running
lore: grading 10 changed files
lore: 7 of 13 (54%) at skill bb50baf, create on claude-opus-5-5, the grade on claude-opus-5-5. Results in ~/.t3/worktrees/skills/feat-103-verification-skill-eval/skills/verification-skill/evals/results.md
```

## Left behind after the runs

Checked by hand after each run finished, at 2026-10-25T18:21Z for the last one:

```console
$ ps -axwwE -o pid=,command= | grep -c "[V]ERIFICATION_SKILL_EVAL_RUN=visaroy-20261025T171634Z"
0
$ ps -axwwE -o pid=,command= | grep -c "[V]ERIFICATION_SKILL_EVAL_RUN=visaroy-20261025T174519Z"
0
$ ps -axwwE -o pid=,command= | grep -c "[V]ERIFICATION_SKILL_EVAL_RUN=lore-20261025T171634Z"
0
$ ps -axwwE -o pid=,command= | grep -c "[V]ERIFICATION_SKILL_EVAL_RUN=lore-20261025T175935Z"
0
$ ls -d $TMPDIR/verification-skill-eval-*    # each run's temp folder, checkout included
(none)
$ xcrun simctl list devices booted | grep -c Booted
0
$ git -C ~/code/lore rev-parse --short HEAD; git -C ~/code/visaroy rev-parse --short HEAD    # main checkouts, unchanged
d036ec64
d451ba91
$ git -C ~/code/lore worktree list | grep -c verification-skill; git -C ~/code/visaroy worktree list | grep -c verification-skill
0
0
```
