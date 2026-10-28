# Results

Each section is one run of `run.mjs <case>`: the date, the skill's commit, the score and each lesson's verdict. A covered lesson scores 1, a partly covered one 0.5 and a missing one 0. The case repos are private, so the grader's quotes and replay notes stay in the run folder.

# Earlier results on Claude

These sections ran on Claude. They do not compare with Codex scores.

## visaroy, 2026-10-25, skill 5084b3d

Score 7.5 of 19 (39%). Create took 14 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-25, skill c9b4fb8

Score 6 of 19 (32%). Create took 13 min, and the grade 1 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | partly |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | missing |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | missing |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## lore, 2026-10-25, skill bb50baf

Score 7 of 13 (54%). Create took 17 min, and the grade 3 min.
Replay: launch skipped, doctor skipped, drive skipped, cleanup passed.
Left behind, and stopped by the eval: after create: idb_companion, idb_companion; after the grade: ibtoold, ibtoold, ibtoold.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | partly |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |

## visaroy, 2026-10-25, skill bc2e9c9

Score 7 of 19 (37%). Create took 35 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | covered |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | partly |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | partly |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-25, skill bc2e9c9

Score 8 of 19 (42%). Create took 28 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | covered |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | partly |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | partly |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-25, skill 7510046

Score 5.5 of 19 (29%). Create took 29 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | missing |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | missing |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | partly |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-25, skill 7510046

Score 7.5 of 19 (39%). Create took 24 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | partly |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | partly |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-26, skill 4b75cd5

Score 8 of 19 (42%). Create took 33 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | partly |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | missing |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | covered |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | missing |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | partly |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-26, skill 4b75cd5

Score 7.5 of 19 (39%). Create took 21 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | partly |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## lore, 2026-10-26, skill 4b75cd5

Score 5.5 of 13 (42%). Create took 117 min, and the grade 6 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: idb_companion, idb_companion, idb_companion, idb_companion, idb_companion, idb_companion, idb_companion; after the grade: ibtoold, ibtoold, ibtoold, idb_companion.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | missing |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | partly |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | partly |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | missing |

## lore, 2026-10-26, skill 4b75cd5

Score 6.5 of 13 (50%). Create took 108 min, and the grade 6 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: ibtoold, ibtoold, ibtoold.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | partly |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | partly |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |

## visaroy, 2026-10-26, skill 6da230f

Score 8 of 19 (42%). Create took 28 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-26, skill 6da230f

Score 10.5 of 19 (55%). Create took 24 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | covered |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | covered |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## lore, 2026-10-26, skill 6da230f

Score 7.5 of 13 (58%). Create took 147 min, and the grade 13 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: idb_companion, idb_companion, idb_companion, idb_companion; after the grade: idb_companion.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |

## visaroy, 2026-10-26, skill 857735b

Score 6 of 19 (32%). Create took 41 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | missing |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | missing |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | partly |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | missing |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-26, skill 857735b

Score 8 of 19 (42%). Create took 43 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | partly |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | covered |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | covered |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | missing |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | partly |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-27, skill e740174

Score 8.5 of 19 (45%). Create took 21 min, and the grade 1 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | missing |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | covered |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## visaroy, 2026-10-27, skill e740174

Score 7.5 of 19 (39%). Create took 18 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | missing |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | missing |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | covered |
| 14. Point at the source instead of copying changing values (edc28879). | partly |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## lore, 2026-10-27, skill e740174

Score 6.5 of 13 (50%). Create took 82 min, and the grade 2 min.
Replay: launch skipped, doctor skipped, drive skipped, cleanup passed.
Left behind, and stopped by the eval: after create: idb_companion, idb_companion, idb_companion, idb_companion, idb_companion, idb_companion, idb_companion; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | partly |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | partly |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |

## lore, 2026-10-27, skill e740174

Score 5.5 of 13 (42%). Create took 116 min, and the grade 5 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: ibtoold, ibtoold, ibtoold.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | missing |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | partly |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | missing |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | partly |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | missing |

## visaroy, 2026-10-27, skill c651e6e

Score 10 of 19 (53%). Create took 18 min, and the grade 2 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | covered |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | missing |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | partly |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | partly |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | covered |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | covered |

## visaroy, 2026-10-27, skill c651e6e

Score 9 of 19 (47%). Create took 17 min, and the grade 1 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: nothing.

| Lesson | Verdict |
| --- | --- |
| 1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23). | partly |
| 2. Flag fixtures with absolute dates (9ceb4e23). | partly |
| 3. Run helpers on GNU and BSD tools (d286d647). | missing |
| 4. Bind to loopback, and have doctor prove it (f7a3336d). | partly |
| 5. Prove recipes on a clean PATH (f7a3336d). | missing |
| 6. Open each capture at full size before calling it proof (800509b7). | partly |
| 7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7). | covered |
| 8. Blank build-time public variables too (ec87acbe). | partly |
| 9. Prove the production-build launch separately (daf4aeb1). | missing |
| 10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1). | partly |
| 11. Name each environment and which ones a run may drive (66a4d9f7). | partly |
| 12. Environment guards fail closed (70479332). | partly |
| 13. Record the revision the target actually serves (e63a07c1). | partly |
| 14. Point at the source instead of copying changing values (edc28879). | covered |
| 15. One unmocked recipe per feature; label mocked ones UI-only (3b722625). | covered |
| 16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb). | missing |
| 17. Never echo URLs or env values (cf53f164). | missing |
| 18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc). | covered |
| 19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569). | partly |

## lore, 2026-10-27, skill c651e6e

Score 7.5 of 13 (58%). Create took 121 min, and the grade 5 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: ibtoold, ibtoold, ibtoold.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | covered |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | covered |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | partly |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | missing |

## lore, 2026-10-27, skill c651e6e

Score 8 of 13 (62%). Create took 42 min, and the grade 5 min.
Replay: launch passed, doctor passed, drive passed, cleanup passed.
Left behind, and stopped by the eval: after create: nothing; after the grade: ibtoold, ibtoold, ibtoold.

| Lesson | Verdict |
| --- | --- |
| 1. Pin the build toolchain in a repo file and build through it (abb228b0). | partly |
| 2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119). | partly |
| 3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c). | partly |
| 4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c). | missing |
| 5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d). | partly |
| 6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3). | partly |
| 7. Name driver sessions per run (41cfde13). | covered |
| 8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de). | partly |
| 9. Give each run its own driver state directory (0252f506). | partly |
| 10. Link to the file that owns a version pin instead of copying it (5ab2c3c1). | covered |
| 11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514). | covered |
| 12. A measurement must require that something was measured (a42ae484, d0ce329c). | covered |
| 13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647). | partly |

# Codex results

Each section below names the driver, pinned skill commit, three individual scores, their mean and spread, and starting load per run.
