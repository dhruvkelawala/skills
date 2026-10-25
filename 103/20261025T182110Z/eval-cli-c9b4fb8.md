# verification-skill eval: the cases and the runner's tests

Captured at `c9b4fb8` on 2026-10-25T17:45Z.

## The cases load, each lesson citing a commit or PR

```console
$ node skills/verification-skill/evals/run.mjs
usage: node skills/verification-skill/evals/run.mjs [<case>]

cases:
  lore       dhruvkelawala/lore at 0591fa83, 13 lessons
  visaroy    dhruvkelawala/visaroy at 8ec6495c, 19 lessons
exit 0
```

## A case with an uncited lesson is refused

A scratch copy of the skill, with `cases/uncited.md` added, whose lesson 2 cites nothing:

```console
$ node <scratch>/skills/verification-skill/evals/run.mjs uncited
<scratch>/skills/verification-skill/evals/cases/uncited.md: lesson 2 cites no commit or PR
exit 2
```

## The runner's tests: a fake claude and a fake xcrun on PATH, a scratch case repo

```console
$ node --test skills/verification-skill/evals/run.test.mjs
▶ cases
  ✔ lore and visaroy load, each lesson citing a commit or PR (51.069709ms)
  ✔ refuses a case with a lesson that cites no commit or PR (45.356083ms)
✔ cases (97.78825ms)
▶ a run
  ✔ the create agent works at the base with only the skill, with no ref to later commits, no gh and no push (1.012583ms)
  ✔ appends the grader's score to results.md, with the date and the commit of the skill it ran (0.19275ms)
  ✔ stops what the agents left running and removes the checkout, keeping what create wrote (166.395666ms)
✔ a run (10340.752583ms)
▶ a run whose create agent dies
  ✔ still shuts down the simulator it booted, stops its processes, keeps what it wrote, removes the checkout and scores nothing (0.251625ms)
✔ a run whose create agent dies (3573.671833ms)
ℹ tests 6
ℹ suites 3
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14242.559417
```
