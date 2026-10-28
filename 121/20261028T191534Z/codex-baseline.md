# Codex evaluation measurements

Captured from completed eval records at runner source `268d1181818db2d27abcf020f52afac686f038b1`. Model and effort come from the eval job in models.json. All creates used the pinned skill source. Private case quotes and raw transcripts are omitted.


Each section below names the driver, pinned skill commit, three individual scores, their mean and spread, and starting load per run.

## visaroy, 2026-10-28, skill b59ad166856f8cb51d2c205ca9d35d231dc1132c

Driver: codex. Runs: 3.
Mean 11.17 of 19 (59%). Spread 1 (10.5 to 11.5).

### Run 1: Score 10.5 of 19 (55%). Create took 23 min, and the grade 5 min.
Starting load (1, 5, 15 min): 4.095703125, 5.5439453125, 11.95263671875.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | covered |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | partly |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | covered |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |
### Run 2: Score 11.5 of 19 (61%). Create took 24 min, and the grade 6 min.
Starting load (1, 5, 15 min): 2.470703125, 2.91748046875, 4.568359375.
Replay: launch passed, doctor passed, drive passed, cleanup failed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | partly |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | covered |
| 9. Prove the production-build launch separately (daf4aeb1). | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | covered |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |
### Run 3: Score 11.5 of 19 (61%). Create took 18 min, and the grade 5 min.
Starting load (1, 5, 15 min): 3.49609375, 3.90185546875, 4.29736328125.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | partly |
| 3. Run helpers on GNU and BSD tools (d286d647). | partly |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | partly |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | covered |
| 9. Prove the production-build launch separately (daf4aeb1). | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | covered |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-28, skill a12801587490583e2c83619d3f61e439aaea090a

Driver: codex. Runs: 3.
Mean 13.17 of 19 (69%). Spread 1 (12.5 to 13.5).

### Run 1: Score 13.5 of 19 (71%). Create took 33 min, and the grade 5 min.
Starting load (1, 5, 15 min): 2.669921875, 7.81640625, 16.126953125.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | covered |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | covered |
| 5. Prove recipes on a clean PATH (f7a3336d). | partly |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | covered |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | covered |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | covered |
### Run 2: Score 12.5 of 19 (66%). Create took 42 min, and the grade 7 min.
Starting load (1, 5, 15 min): 6.48486328125, 7.1279296875, 6.912109375.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | covered |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | covered |
| 5. Prove recipes on a clean PATH (f7a3336d). | partly |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | covered |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | covered |
### Run 3: Score 13.5 of 19 (71%). Create took 33 min, and the grade 5 min.
Starting load (1, 5, 15 min): 2.86328125, 3.08984375, 4.59375.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | covered |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | covered |
| 5. Prove recipes on a clean PATH (f7a3336d). | partly |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | covered |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | covered |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | covered |

## lore, 2026-10-28, skill b59ad166856f8cb51d2c205ca9d35d231dc1132c

Driver: codex. Runs: 3.
Mean 8.67 of 13 (67%). Spread 1.5 (8 to 9.5).

### Run 1: Score 8 of 13 (62%). Create took 64 min, and the grade 7 min.
Starting load (1, 5, 15 min): 2.63134765625, 3.86572265625, 3.779296875.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | missing |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | partly |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | covered |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | covered |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |
### Run 2: Score 8.5 of 13 (65%). Create took 57 min, and the grade 9 min.
Starting load (1, 5, 15 min): 1.75, 7.67431640625, 9.1337890625.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | partly |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | partly |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | covered |
| 9. Give each run its own driver state directory (0252f506). | missing |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | covered |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |
### Run 3: Score 9.5 of 13 (73%). Create took 53 min, and the grade 9 min.
Starting load (1, 5, 15 min): 5.15380859375, 7.4306640625, 11.16015625.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: not recorded before the original grader failure; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | covered |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | covered |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | covered |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |

Run 3's create completed, but its first grader stopped on model capacity. Its saved create patch was restored exactly and graded with the same model after the quiet-machine gate. The original create-phase sweep inventory was not recorded; both failed-run and recovery cleanup completed. Grader restart load (1, 5, 15 min): 4.54638671875, 7.869140625, 15.44482421875.
