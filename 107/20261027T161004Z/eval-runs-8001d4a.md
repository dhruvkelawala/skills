# #107: eval runs at `8001d4a`

Each run is `node skills/verification-skill/evals/run.mjs <case>`, one at a time on the Mini, at `8001d4a` (after review pass 1 and the autoreview; `b4a666b` after the rebase). Review pass 2's repair came after these runs, so no run scored it. Before each run, a script waited until the 5-minute load was under 8 and no other `evals/run.mjs`, `xcodebuild` (apart from `-license check`), `cargo` or `expo run` was running. Other projects' agents shared the machine during the runs, so the load during a run is not all the eval's. The baseline is #131's four runs at `c651e6e`, the same `SKILL.md` as main before this change.

## Scores

| Case | Baseline (`c651e6e`) | This change (`8001d4a`) |
| --- | --- | --- |
| Visaroy, of 19 | 9.5 (10, 9) | 10.75 (11, 10.5) |
| Lore, of 13 | 7.75 (7.5, 8) | 7, one run |

| Run folder | Score | Create | 5-min load at start | 5-min load during the run, median and max | Left behind, stopped by the eval |
| --- | --- | --- | --- | --- | --- |
| visaroy-20261027T130749Z | 11 | 26 min | 4.34 | 7.88, 13.90 (create's record) | nothing; nothing |
| visaroy-20261027T135016Z | 10.5 | 21 min | 7.44 | 8.38, 20.76 | nothing; nothing |
| lore-20261027T143805Z | 7 | 68 min | 6.70 | 26.36, 111.39 | nothing; after the grade, `ibtoold` x3 (as in both baseline runs) |

## Lessons that moved

Points over both runs, baseline to this change. Visaroy, 19 to 21.5:

- Up: 4 (bind to loopback, and have doctor prove it) +1.5, covered in both, from missing and partly. 12 (environment guards fail closed) +1, covered in both, from partly twice. 17 (never echo URLs or env values) +1, partly in both, from missing twice. 8, 11, 13, 16 and 19 (a port per run, and killing the whole process group) +0.5 each.
- Down: 2 (flag fixtures with absolute dates) −1.5, missing in both, from covered and partly. 7 (dev-only seed) −1. 9 (production-build launch) and 10 (each spec's mocks) −0.5 each.

Lore, its one run against the baseline's mean per lesson: 13 (stop recorders in a `finally`) partly, from missing and partly. 10 (link to the file that owns a version pin) partly, from covered twice: the written skill copied the Node and pnpm versions into its prerequisites. 12 (a measurement requires something measured) partly, from covered twice: a duration check is skipped when `ffprobe` is missing. 11 partly, from partly and covered. The rest match. Lore's second run was skipped to save time, so Lore's score rests on one run.

## What create wrote and did (scan of each run)

Before this change, none of the four baseline runs wrote a hazards section, an inventory, an ownership file or a survivor check, and every baseline create ran its replays one at a time.

| Run | Hazards (of 5) | Inventory rows | Columns | Process groups, ownership file, survivor check | Two runs at once |
| --- | --- | --- | --- | --- | --- |
| Visaroy 1 | 5 | 13 | claim, busy, release, doctor | yes, yes, yes | both passed: the second found the first's port lock, said so, and took the next port |
| Visaroy 2 | 5 | 11 | claim, busy, release, doctor | yes, yes, yes | one passed; the other was refused on the first's build-cache lock, named the holder, then waited and passed |
| Lore 1 | 5 | 13 | claim, busy, release, doctor | yes, yes, yes | one passed; the other was refused on the first's native-project lock and stopped before prebuild |

Create found one gap in its own share check: in Visaroy run 2, the refused run had already made its run folder, although the refusal said nothing had changed. Create moved the lock before the folder, proved it by hand, and named it as a fix no replay ran.

## Before and after Cleanup

From the replays' reports, in generic terms:

- **Visaroy 1, two at once.** Each Cleanup listed its process group, run folder and port lock before, then both paths `gone`, and `survivors: none`.
- **Visaroy 2, two at once.** Each Cleanup listed its run folder, its database folder and a PDF cache folder before, then all three `gone`, and `survivors (none)`.
- **Lore 1, two at once.** The run that passed listed its simulator, its derived-data folder, its temp folder and the native project folder its prebuild generated before. It deleted them, showed each `(gone)`, and printed an empty survivor list and the captures it kept. The refused run had booted its simulator and claimed a port; its Cleanup listed both, deleted them, showed them `(gone)` and printed an empty survivor list.

## The machine before and after each run

A read-only snapshot before and after each run listed simulators, top-level `/tmp` and `$TMPDIR`, DerivedData, listening ports and processes. It talks to no device.

- **Visaroy 1 and 2.** No new simulator, DerivedData folder or listener from the run. What stayed is the skill's own captures folder in `$TMPDIR`, with empty run and lock folders, and create's command record.
- **Lore 1.** The simulator list was identical before and after: the same 23 devices in the same states, including another thread's booted simulator, which the run left alone. Create named six simulators for its runs, and none is left. No new DerivedData under `~/Library`, and no new build folder in `/tmp`. The skill's `$TMPDIR` folder holds only its empty lock and port folders.

New `/tmp` and `$TMPDIR` entries from other projects' agents, which ran at the same time, are left out.
