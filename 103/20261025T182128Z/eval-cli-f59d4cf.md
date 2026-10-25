# verification-skill eval: the cases and the runner's tests

Captured at `f59d4cf` on 2026-10-25T18:21Z.

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
  ✔ lore and visaroy load, each lesson citing a commit or PR (34.49125ms)
  ✔ refuses a case with a lesson that cites no commit or PR (45.319583ms)
✔ cases (80.3385ms)
▶ a run
  ✔ the create agent works at the base with only the skill, with no ref to later commits, no gh and no push (0.487709ms)
  ✔ appends the grader's score to results.md, with the date and the commit of the skill it ran (0.148125ms)
  ✔ stops what the agents left running and removes the checkout, keeping what create wrote, links included (27.782125ms)
✔ a run (1883.665334ms)
▶ a run whose create agent dies
  ✔ still shuts down the simulator it booted, stops its processes, keeps what it wrote, removes the checkout and scores nothing (0.202917ms)
✔ a run whose create agent dies (1057.954333ms)
ℹ tests 6
ℹ suites 3
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3107.328291
```
