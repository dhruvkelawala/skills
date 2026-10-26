# verification-skill: Create's text against #105's criteria 1 and 2

A scratch checker reads `skills/verification-skill/SKILL.md` at a commit and checks the Create section for what the issue asks. It isn't committed: a test that matches phrases in a skill would pin its wording, not its behaviour. The eval page shows the behaviour.

## At the base, `3bc6970` (main)

```console
$ node check-create.mjs 3bc6970
MISS 1 Create's steps are Run, Record, Write, Replay, in order
MISS 1 rule: ready means usable, from an empty data folder with migrations and seed data
MISS 1 rule: a journey the seed data can't satisfy fails, reason in Gotchas, never weakened
MISS 1 rule: a stand-in run lists every setup step the stand-in did that the target won't
MISS 1 record: each command that worked, and each that failed and why
MISS 1 write: Launch, Doctor, Drive and Cleanup from the record alone
MISS 1 the record starts in Run, before the first command (pass 1)
MISS 1 Write covers every section the skill has, Evidence included (pass 1)
MISS 1 a fix during Replay comes from a command that ran (pass 1)
MISS 1 Run captures what it drives, so Write can take Evidence from the record (pass 2)
MISS 2 create waits in the foreground for each replay's report (live Lore run)
MISS 1 no feature is mapped but unproven; the rest go in Not mapped yet
MISS 2 the completion line is the Replay step's
MISS 2 the completion line requires a fresh subagent's replay
MISS 2 the completion line requires that replay to be clean: no question, nothing improvised
MISS 2 the completion line requires that replay to drive every mapped feature
3bc6970: 16 of 16 missing
```

## At the head, `7510046`

```console
$ node check-create.mjs 7510046
ok   1 Create's steps are Run, Record, Write, Replay, in order
ok   1 rule: ready means usable, from an empty data folder with migrations and seed data
ok   1 rule: a journey the seed data can't satisfy fails, reason in Gotchas, never weakened
ok   1 rule: a stand-in run lists every setup step the stand-in did that the target won't
ok   1 record: each command that worked, and each that failed and why
ok   1 write: Launch, Doctor, Drive and Cleanup from the record alone
ok   1 the record starts in Run, before the first command (pass 1)
ok   1 Write covers every section the skill has, Evidence included (pass 1)
ok   1 a fix during Replay comes from a command that ran (pass 1)
ok   1 Run captures what it drives, so Write can take Evidence from the record (pass 2)
ok   2 create waits in the foreground for each replay's report (live Lore run)
ok   1 no feature is mapped but unproven; the rest go in Not mapped yet
ok   2 the completion line is the Replay step's
ok   2 the completion line requires a fresh subagent's replay
ok   2 the completion line requires that replay to be clean: no question, nothing improvised
ok   2 the completion line requires that replay to drive every mapped feature
7510046: 0 of 16 missing
```

The lines marked `(pass 1)` and `(pass 2)` were added for review findings. Each was red at the commit before its fix: `6990f17` missed the three pass 1 lines, and `784368e` missed the pass 2 line. The `(live Lore run)` line was red at `bc2e9c9`.

## The checker

```js
const checks = [
  ["1 Create's steps are Run, Record, Write, Replay, in order", () => steps.join(",") === "Run,Record,Write,Replay"],
  ["1 rule: ready means usable, from an empty data folder with migrations and seed data", () => has(create, /ready means usable/i, /empty data folder/i, /migrations and seed data/i)],
  ["1 rule: a journey the seed data can't satisfy fails, reason in Gotchas, never weakened", () => has(create, /seed data can(?:'|no)t satisfy/i, /fails/i, /Gotchas/, /never weaken/i)],
  ["1 rule: a stand-in run lists every setup step the stand-in did that the target won't", () => has(create, /stand-in/i, /every setup step the stand-in did that the target (?:won't|will not)/i)],
  ["1 record: each command that worked, and each that failed and why", () => has(create, /each command that worked/i, /each (?:one )?that failed/i)],
  ["1 write: Launch, Doctor, Drive and Cleanup from the record alone", () => has(create, /Launch, Doctor, Drive,? (?:Evidence )?and Cleanup/, /from the record alone/i)],
  ["1 the record starts in Run, before the first command (pass 1)", () => /record[^.]*before the first command/i.test(create.split("2. **Record.**")[0])],
  ["1 Write covers every section the skill has, Evidence included (pass 1)", () => /Write Launch, Doctor, Drive, Evidence and Cleanup/.test(create)],
  ["1 a fix during Replay comes from a command that ran (pass 1)", () => /Run each fix yourself, add its commands? to the record|Fix the skill from a command that ran/.test(create)],
  ["1 Run captures what it drives, so Write can take Evidence from the record (pass 2)", () => /Drive and capture/.test(create.split("2. **Record.**")[0])],
  ["2 create waits in the foreground for each replay's report (live Lore run)", () => /Run it in the foreground and wait for its report/.test(create)],
  ["1 no feature is mapped but unproven; the rest go in Not mapped yet", () => !/mapped but unproven/i.test(skill) && /Not mapped yet/.test(create)],
  ["2 the completion line is the Replay step's", () => steps.at(-1) === "Replay" && completes.length === steps.length],
  ["2 the completion line requires a fresh subagent's replay", () => has(last, /fresh subagent/i, /replay/i)],
  ["2 the completion line requires that replay to be clean: no question, nothing improvised", () => has(last, /asked nothing|no question/i, /improvised nothing|nothing improvised/i)],
  ["2 the completion line requires that replay to drive every mapped feature", () => has(last, /every mapped feature/i)],
];
```
