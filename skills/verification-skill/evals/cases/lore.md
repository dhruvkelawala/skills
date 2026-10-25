# Lore

Lore's verify skill, `verify-lore`, was written by `create-verification-skill` in d42c58da on 2026-09-30, then fixed by hand 18 times. The lessons below are the generic ones, mined from its history on 2026-10-25.

- Repo: dhruvkelawala/lore
- Checkout: ~/code/lore
- Base: 0591fa83cd16e40a8685e2c3ba08ee37006413a1

## Lessons

1. Pin the build toolchain in a repo file and build through it (abb228b0).
2. On a person's own device, back up their data first and confirm the new build loaded (fc00e119).
3. Evidence ends with a publish command whose links a reviewer can open (f7b0173c).
4. Open each published link where the reviewer reads, such as T3 on a phone (5c16c49c).
5. Pass twice in a row with retries off, with unique data and storage checked before and after (fea1cb9d).
6. Dismiss known system prompts at every step, and delete what each test creates (503c85a3).
7. Name driver sessions per run (41cfde13).
8. Say which claims each build configuration can support, such as dev builds and feel (d036ec64, a9f7d5de).
9. Give each run its own driver state directory (0252f506).
10. Link to the file that owns a version pin instead of copying it (5ab2c3c1).
11. Don't assume the seeded layout; wait for an element before measuring it (3010b086, d33d24db, 0ccfe514).
12. A measurement must require that something was measured (a42ae484, d0ce329c).
13. Catch short-lived states from video, and stop recorders in a `finally` (7fb75647).
