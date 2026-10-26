# #117: the eval at 4b75cd5

Each run is `node skills/verification-skill/evals/run.mjs <case>` from the repo root at 4b75cd5, the final text of Create step 4. Create and the grade ran on claude-opus-5-5. The case repos are private, so this page holds scores, timings and replay counts only. Each run's full section is in `skills/verification-skill/evals/results.md` in the PR.

## Runner output

```text
visaroy: 8 of 19 (42%) at skill 4b75cd5, create on claude-opus-5-5, the grade on claude-opus-5-5. Results in skills/verification-skill/evals/results.md
```
```text
visaroy: 7.5 of 19 (39%) at skill 4b75cd5, create on claude-opus-5-5, the grade on claude-opus-5-5. Results in skills/verification-skill/evals/results.md
```
```text
lore: 5.5 of 13 (42%) at skill 4b75cd5, create on claude-opus-5-5, the grade on claude-opus-5-5. Results in skills/verification-skill/evals/results.md
```
```text
lore: 6.5 of 13 (50%) at skill 4b75cd5, create on claude-opus-5-5, the grade on claude-opus-5-5. Results in skills/verification-skill/evals/results.md
```

## Create: time and replays

| Run | Started (UTC) | Create | Replays (start, UTC) | Foreground | Grader replay |
| --- | --- | --- | --- | --- | --- |
| visaroy 1 | 02:08 | 34 min | 2 (02:28, 02:39) | all | launch, doctor, drive, cleanup passed |
| visaroy 2 | 02:45 | 21 min | 2 (02:55, 03:02) | all | launch, doctor, drive, cleanup passed |
| lore 1 | 02:08 | 117 min (cap 180) | 3 (02:46, 03:10, 03:30), 19, 17 and 24 min | all | launch, doctor, drive, cleanup passed |
| lore 2 | 04:13 | 108 min (cap 180) | 3 (05:01, 05:17, 05:36), 14, 17 and 18 min | all | launch, doctor, drive, cleanup passed |

Both Lore creates started replay 3 as the last one allowed, fixed what it raised themselves, and ended with a reply section listing the fixes no replay ran (four in run 1). Between replays they applied nits without replaying.

## Against the base text and the baseline

| Case | Text | Scores | Replays per create | Create time |
| --- | --- | --- | --- | --- |
| Lore | baseline bb50baf (before #105) | 7 of 13 | none (create had no replay step) | 17 min; its grader skipped launch, doctor and drive |
| Lore | base 7510046 (#105, = main 29dd9cb) | no score | 7, the 7th cut off | hit the 180-min cap |
| Lore | 4b75cd5 (this PR) | 5.5 and 6.5 of 13, mean 6.0 | 3 and 3 | 117 and 108 min |
| Visaroy | baseline 5084b3d, c9b4fb8 | 7.5 and 6 of 19, mean 6.75 | none | 14 and 13 min |
| Visaroy | base 7510046 | 5.5 and 7.5 of 19 | 3 and 6 | 29 and 24 min |
| Visaroy | 4b75cd5 (this PR) | 8 and 7.5 of 19, mean 7.75 | 2 and 2 | 34 and 21 min |

Lore lessons that moved against the baseline (7 of 13):

- Covered to partly: lesson 11 ("Don't assume the seeded layout; wait for an element before measuring it"), in both runs. The grader found recipes that still tap fixed coordinates.
- Partly to missing, run 1 only: lesson 2 (back up a person's own device first), because the skill covers only the simulator; and lesson 13 (catch short-lived states from video), because video was left unrun.
- Every other lesson got the baseline's verdict in both runs. No lesson rose.

The baseline's grader skipped launch, doctor and drive, so it scored a skill it never ran. These graders ran launch, doctor, one drive and cleanup, and each passed. The numbers are less comparable than they look.

One hint, not proof: #105's capped Lore create, after seven replays, had written 801 lines with no fixed-coordinate tap. Run 1 wrote 462 lines with 7, and run 2 wrote 632 with 1. Fewer replays may buy less polish on the layout lesson. That is one run each way.

## Left behind and cleanup

- The eval stopped what each run left: visaroy runs, nothing; lore run 1, 7 idb_companion after create and 3 ibtoold plus 1 idb_companion after the grade; lore run 2, nothing after create and 3 ibtoold after the grade.
- Each create wrote to fixed /tmp paths (its record and run folders). They were moved into each run's folder before the next run of the same case. Fixed /tmp paths are #107's scope.
- Other threads' booted simulators and /tmp folders were left alone.
