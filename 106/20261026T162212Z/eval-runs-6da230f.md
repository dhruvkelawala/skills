# #106: the eval at the head, against the baseline and #119

Each run is `node skills/verification-skill/evals/run.mjs <case>` from this branch's worktree. The skill commit is the one `run.mjs` recorded. The case repos are private, so this page has scores, lesson titles (already public in `results.md`), counts and generic descriptions only.

## Scores

| Case | Skill commit | Score | Create | Replays | Grader's replay |
| --- | --- | --- | --- | --- | --- |
| Visaroy | `6da230f` (this PR) | 8 of 19 | 28 min | 2 | launch, doctor, drive, cleanup passed |
| Visaroy | `6da230f` (this PR) | 10.5 of 19 | 24 min | 1 | launch, doctor, drive, cleanup passed |
| Lore | `6da230f` (this PR) | 7.5 of 13 | 147 min | 2 | launch, doctor, drive, cleanup passed |
| Lore | `6da230f` (this PR) | no score: create stopped by the 180-min cap | 180 min | 3, the last cut off | not run |
| Visaroy | `4b75cd5` (#119) | 8 and 7.5 of 19, mean 7.75 | 34 and 21 min | 2 and 2 | passed |
| Lore | `4b75cd5` (#119) | 5.5 and 6.5 of 13, mean 6.0 | 117 and 108 min | 3 and 3 | passed |
| Visaroy, #103 baseline | `5084b3d`, `c9b4fb8` | 7.5 and 6 of 19, mean 6.75 | 14 and 13 min | none | passed |
| Lore, #103 baseline | `bb50baf` | 7 of 13 | 17 min | none | launch, doctor and drive skipped |

Visaroy at the head: mean 9.25 of 19, against 6.75 (baseline) and 7.75 (#119). Lore at the head: one score, 7.5 of 13, against 7 (baseline) and 6.0 (#119); the second run has no score.

Lore run 2's runner output:

```text
lore: create is running
Error: create: the agent run failed (exit 143, stopped after 180 min), transcript …/lore-20261026T131838Z/create.jsonl
```

Its timeline: Run and Write 49 min, replay 1 33 min, create's own fixes 35 min, replay 2 35 min (it found a gap), fixes 11 min, replay 3 cut off by the cap. At #119's text, Lore's replays took 14 to 25 min and create's fixes between them a few minutes; Run and Write took 38 to 49 min, the same as here.

## Lessons, Visaroy

| Lesson | `5084b3d` 7.5 | `c9b4fb8` 6 | `4b75cd5` 8 | `4b75cd5` 7.5 | `6da230f` 8 | `6da230f` 10.5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly | partly | partly | partly | partly | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing | partly | partly | missing | missing | covered |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing | missing | missing | partly | missing | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing | missing | partly | partly | partly | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing | missing | missing | missing | missing | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly | partly | missing | partly | partly | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly | missing | covered | missing | missing | covered |
| 8. Blank build-time public variables too (ec87acbe). | partly | missing | partly | partly | partly | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing | missing | missing | missing | missing | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly | partly | partly | partly | partly | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly | missing | partly | partly | partly | partly |
| 12. Environment guards fail closed (70479332). | partly | partly | missing | partly | partly | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly | partly | partly | partly | covered | covered |
| 14. Point at the source instead of copying changing values (edc28879). | partly | partly | partly | partly | partly | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered | covered | covered | covered | covered | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing | missing | partly | missing | missing | missing |
| 17. Never echo URLs or env values (cf53f164). | partly | missing | missing | missing | partly | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered | covered | covered | covered | covered | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly | partly | partly | partly | partly | partly |

## Lessons, Lore

| Lesson | `bb50baf` 7 | `4b75cd5` 5.5 | `4b75cd5` 6.5 | `6da230f` 7.5 |
| --- | --- | --- | --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly | partly | partly | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly | missing | partly | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered | covered | covered | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing | missing | missing | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly | partly | partly | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly | partly | partly | partly |
| 7. Name driver sessions per run (41cfde13). | covered | covered | covered | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly | partly | partly | partly |
| 9. Give each run its own driver state directory (0252f506). | partly | partly | partly | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing | missing | missing | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered | partly | partly | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | partly | partly | partly | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly | missing | partly | partly |

The lessons #106 aims at: Lore 5 (retries off) and 12 (a measurement must show something was measured); Visaroy 6 (open each capture), 10 (list each spec's mocks) and 15 (one unmocked recipe per feature). Lore 12 rose to covered; Visaroy 10 rose to covered in one run of two; Visaroy 15 stayed covered; Lore 5 and Visaroy 6 stayed partly.

## Criterion 2: what each run's create saw fail

`scan-seen-failing.mjs` (scratch, uncommitted) reads each run folder: the verify skill create wrote, and create's own transcript. The doctor lines count lines in the written skill that say doctor failed against a stopped or a stale instance. "Non-zero exit" counts create's doctor commands whose result shows a failing exit; one command can hold several failures, so it's a floor.

How doctor was seen failing, in the runs at the head, described generically:

- Visaroy run 1: after cleanup (stopped), exit 1 with six failing checks; and an earlier build launched from a clone of the base revision on other ports (stale), exit 1.
- Visaroy run 2: four cases, each exit 1: the dev server killed and the database stopped (stopped); launched at another revision, and a server using another database URL (stale).
- Lore run 1: the dev server killed and the app terminated (stopped); a dev server started with another fixture profile, and the debug state checked while the release build was installed (stale).

### At #119's text (`4b75cd5`)

```text
visaroy-20261026T020832Z: verify skills 1
 verify-visaroy:
  index has `What counts as a pass`: no
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 0
  doctor seen failing, stale instance (skill text lines): 0
  feature files: 6
  feature files that say how their proof was seen failing: 0
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 2
  doctor commands run by create (not its replays): 5
  of those, ones whose result shows a non-zero exit: 0
visaroy-20261026T024458Z: verify skills 1
 verify-web:
  index has `What counts as a pass`: no
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 0
  doctor seen failing, stale instance (skill text lines): 0
  feature files: 4
  feature files that say how their proof was seen failing: 0
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 2
  doctor commands run by create (not its replays): 2
  of those, ones whose result shows a non-zero exit: 0
lore-20261026T020832Z: verify skills 1
 verify-lore:
  index has `What counts as a pass`: no
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 0
  doctor seen failing, stale instance (skill text lines): 0
  feature files: 5
  feature files that say how their proof was seen failing: 0
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 3
  doctor commands run by create (not its replays): 1
  of those, ones whose result shows a non-zero exit: 0
lore-20261026T041302Z: verify skills 1
 verify-lore:
  index has `What counts as a pass`: no
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 0
  doctor seen failing, stale instance (skill text lines): 0
  feature files: 5
  feature files that say how their proof was seen failing: 0
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 3
  doctor commands run by create (not its replays): 9
  of those, ones whose result shows a non-zero exit: 0
```

### At this PR's head (`6da230f`)

```text
visaroy-20261026T104241Z: verify skills 1
 verify-visaroy:
  index has `What counts as a pass`: yes, 12 lines
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 2
  doctor seen failing, stale instance (skill text lines): 2
  feature files: 5
  feature files that say how their proof was seen failing: 5
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 2
  doctor commands run by create (not its replays): 9
  of those, ones whose result shows a non-zero exit: 5
visaroy-20261026T111309Z: verify skills 1
 verify-visaroy:
  index has `What counts as a pass`: yes, 7 lines
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 1
  doctor seen failing, stale instance (skill text lines): 1
  feature files: 5
  feature files that say how their proof was seen failing: 5
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 1
  doctor commands run by create (not its replays): 6
  of those, ones whose result shows a non-zero exit: 1
lore-20261026T103647Z: verify skills 1
 verify-lore:
  index has `What counts as a pass`: yes, 11 lines
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 1
  doctor seen failing, stale instance (skill text lines): 1
  feature files: 6
  feature files that say how their proof was seen failing: 6
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 2
  doctor commands run by create (not its replays): 20
  of those, ones whose result shows a non-zero exit: 4
lore-20261026T131838Z: verify skills 1
 verify-lore:
  index has `What counts as a pass`: yes, 7 lines
  SKILL.md has `What counts as a pass`: no
  doctor seen failing, stopped instance (skill text lines): 1
  doctor seen failing, stale instance (skill text lines): 1
  feature files: 6
  feature files that say how their proof was seen failing: 6
  feature files with a UI-only (mocked) recipe: 0
 transcript:
  replay subagents started by create: 3
  doctor commands run by create (not its replays): 24
  of those, ones whose result shows a non-zero exit: 5
```

`lore-20261026T131838Z` is Lore run 2, stopped by the cap; its skill is what create had written by then.

None of the eight runs wrote a mocked recipe, so the UI-only label had nothing to label; Visaroy's lesson 15 (one unmocked recipe per feature) was covered in every run.
