# #106: the skill text, checked at each commit

A scratch checker (uncommitted, source below) reads `skills/verification-skill/SKILL.md` and `references/feature-map-example/` at a commit and reports which of the contract's checks the text meets. Checks marked `1` are criterion 1 (the "What counts as a pass" section in SKILL.md and the example map), `2` are criterion 2 (create's Run, Record, Write and Replay steps), `r1` came from review pass 1's repair, and `kept` guards #119's replay rule.

Commits: `589695f` is the base (main, #119). `10c195b` adds the section and the example map. `e632f3a` wires create's steps. `6da230f` is review pass 1's repair and the head the eval ran on.

## 589695f

```text
MISS 1 SKILL.md has a `What counts as a pass` section
MISS 1 doctor fails against a stopped and a stale instance
MISS 1 each final assertion runs once where its effect is absent, and fails
MISS 1 the feature file records how
MISS 1 zero tests, any skip or any retry is not a pass
MISS 1 a drive that flaked once runs twice with retries off
MISS 1 a measurement shows something was measured
MISS 1 one unmocked recipe per feature; mocked ones UI-only with mocks listed
MISS 1 a capture is checked for the requested state before it is kept
MISS 1 the index carries the section
MISS 1 the feature shape's drive section ends with how its proof was seen failing
MISS 1 Drive's zero-tests line moved into the section
MISS 1 example README has the section
MISS 1 example: doctor seen failing stopped and stale
MISS 1 example: each feature's proof failed where its effect was absent
MISS 1 example: zero, skipped or retried is not a pass; flaked runs twice
MISS 1 example: a measurement reports its sample count
MISS 1 example: unmocked recipe, UI-only with mocks listed
MISS 1 example: open each capture and check the requested state
MISS 1 example: create-note's proof says how it was seen failing
MISS 1 example: search's proof says how it was seen failing
MISS 1 example: search has a mocked recipe labelled UI-only with its mocks
ok   1 example: both feature files keep the four H2s
MISS 2 Run sees doctor fail against a stopped and a stale instance
MISS 2 Run runs each final assertion where its effect is absent
MISS 2 Run's completion requires the record to show both
MISS 2 Record: a run meant to see a check fail worked only when it failed
MISS 2 Write puts the section and each feature's seen-failing line in the skill
MISS 2 Replay judges results by the section
MISS r1 create sees each check fail once; a later run again only when it changes that check
MISS r1 a feature whose effect can't be made absent: the feature file says why
MISS r1 Run records why when no run can make an effect absent; completion allows it
MISS r1 Write: the proof says how it was seen failing or why it can't be
MISS r1 Run spells the order: stop the instance and run doctor, then a stale one
MISS r1 example: create-note's seen-failing line covers both titles
MISS r1 example: the README says when to see a check fail again
ok   kept: only a gap earns another replay; third replay you start
589695f: 35 of 37 missing
```

## 10c195b

```text
ok   1 SKILL.md has a `What counts as a pass` section
ok   1 doctor fails against a stopped and a stale instance
ok   1 each final assertion runs once where its effect is absent, and fails
ok   1 the feature file records how
ok   1 zero tests, any skip or any retry is not a pass
ok   1 a drive that flaked once runs twice with retries off
ok   1 a measurement shows something was measured
ok   1 one unmocked recipe per feature; mocked ones UI-only with mocks listed
ok   1 a capture is checked for the requested state before it is kept
ok   1 the index carries the section
ok   1 the feature shape's drive section ends with how its proof was seen failing
ok   1 Drive's zero-tests line moved into the section
ok   1 example README has the section
ok   1 example: doctor seen failing stopped and stale
ok   1 example: each feature's proof failed where its effect was absent
ok   1 example: zero, skipped or retried is not a pass; flaked runs twice
ok   1 example: a measurement reports its sample count
ok   1 example: unmocked recipe, UI-only with mocks listed
ok   1 example: open each capture and check the requested state
ok   1 example: create-note's proof says how it was seen failing
ok   1 example: search's proof says how it was seen failing
ok   1 example: search has a mocked recipe labelled UI-only with its mocks
ok   1 example: both feature files keep the four H2s
MISS 2 Run sees doctor fail against a stopped and a stale instance
MISS 2 Run runs each final assertion where its effect is absent
MISS 2 Run's completion requires the record to show both
MISS 2 Record: a run meant to see a check fail worked only when it failed
MISS 2 Write puts the section and each feature's seen-failing line in the skill
MISS 2 Replay judges results by the section
MISS r1 create sees each check fail once; a later run again only when it changes that check
MISS r1 a feature whose effect can't be made absent: the feature file says why
MISS r1 Run records why when no run can make an effect absent; completion allows it
MISS r1 Write: the proof says how it was seen failing or why it can't be
MISS r1 Run spells the order: stop the instance and run doctor, then a stale one
MISS r1 example: create-note's seen-failing line covers both titles
MISS r1 example: the README says when to see a check fail again
ok   kept: only a gap earns another replay; third replay you start
10c195b: 13 of 37 missing
```

## e632f3a

```text
ok   1 SKILL.md has a `What counts as a pass` section
ok   1 doctor fails against a stopped and a stale instance
ok   1 each final assertion runs once where its effect is absent, and fails
ok   1 the feature file records how
ok   1 zero tests, any skip or any retry is not a pass
ok   1 a drive that flaked once runs twice with retries off
ok   1 a measurement shows something was measured
ok   1 one unmocked recipe per feature; mocked ones UI-only with mocks listed
ok   1 a capture is checked for the requested state before it is kept
ok   1 the index carries the section
ok   1 the feature shape's drive section ends with how its proof was seen failing
ok   1 Drive's zero-tests line moved into the section
ok   1 example README has the section
ok   1 example: doctor seen failing stopped and stale
ok   1 example: each feature's proof failed where its effect was absent
ok   1 example: zero, skipped or retried is not a pass; flaked runs twice
ok   1 example: a measurement reports its sample count
ok   1 example: unmocked recipe, UI-only with mocks listed
ok   1 example: open each capture and check the requested state
ok   1 example: create-note's proof says how it was seen failing
ok   1 example: search's proof says how it was seen failing
ok   1 example: search has a mocked recipe labelled UI-only with its mocks
ok   1 example: both feature files keep the four H2s
ok   2 Run sees doctor fail against a stopped and a stale instance
ok   2 Run runs each final assertion where its effect is absent
ok   2 Run's completion requires the record to show both
ok   2 Record: a run meant to see a check fail worked only when it failed
ok   2 Write puts the section and each feature's seen-failing line in the skill
ok   2 Replay judges results by the section
MISS r1 create sees each check fail once; a later run again only when it changes that check
MISS r1 a feature whose effect can't be made absent: the feature file says why
MISS r1 Run records why when no run can make an effect absent; completion allows it
MISS r1 Write: the proof says how it was seen failing or why it can't be
MISS r1 Run spells the order: stop the instance and run doctor, then a stale one
MISS r1 example: create-note's seen-failing line covers both titles
MISS r1 example: the README says when to see a check fail again
ok   kept: only a gap earns another replay; third replay you start
e632f3a: 7 of 37 missing
```

## 6da230f

```text
ok   1 SKILL.md has a `What counts as a pass` section
ok   1 doctor fails against a stopped and a stale instance
ok   1 each final assertion runs once where its effect is absent, and fails
ok   1 the feature file records how
ok   1 zero tests, any skip or any retry is not a pass
ok   1 a drive that flaked once runs twice with retries off
ok   1 a measurement shows something was measured
ok   1 one unmocked recipe per feature; mocked ones UI-only with mocks listed
ok   1 a capture is checked for the requested state before it is kept
ok   1 the index carries the section
ok   1 the feature shape's drive section ends with how its proof was seen failing
ok   1 Drive's zero-tests line moved into the section
ok   1 example README has the section
ok   1 example: doctor seen failing stopped and stale
ok   1 example: each feature's proof failed where its effect was absent
ok   1 example: zero, skipped or retried is not a pass; flaked runs twice
ok   1 example: a measurement reports its sample count
ok   1 example: unmocked recipe, UI-only with mocks listed
ok   1 example: open each capture and check the requested state
ok   1 example: create-note's proof says how it was seen failing
ok   1 example: search's proof says how it was seen failing
ok   1 example: search has a mocked recipe labelled UI-only with its mocks
ok   1 example: both feature files keep the four H2s
ok   2 Run sees doctor fail against a stopped and a stale instance
ok   2 Run runs each final assertion where its effect is absent
ok   2 Run's completion requires the record to show both
ok   2 Record: a run meant to see a check fail worked only when it failed
ok   2 Write puts the section and each feature's seen-failing line in the skill
ok   2 Replay judges results by the section
ok   r1 create sees each check fail once; a later run again only when it changes that check
ok   r1 a feature whose effect can't be made absent: the feature file says why
ok   r1 Run records why when no run can make an effect absent; completion allows it
ok   r1 Write: the proof says how it was seen failing or why it can't be
ok   r1 Run spells the order: stop the instance and run doctor, then a stale one
ok   r1 example: create-note's seen-failing line covers both titles
ok   r1 example: the README says when to see a check fail again
ok   kept: only a gap earns another replay; third replay you start
6da230f: 0 of 37 missing
```

## The checker

```js
// Scratch checker for #106: reads verification-skill's SKILL.md and example feature map at a git rev and reports which
// of the contract's text checks they meet. Usage: node check-pass.mjs <rev> (from the skills checkout).
import { execFileSync } from "node:child_process";
const rev = process.argv[2] ?? "HEAD";
const show = (path) => {
  try {
    return execFileSync("git", ["show", `${rev}:skills/verification-skill/${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};
const between = (text, start, end) => {
  const i = text.indexOf(start);
  if (i < 0) return "";
  const j = end ? text.indexOf(end, i + start.length) : -1;
  return text.slice(i, j < 0 ? undefined : j);
};
const flat = (s) => s.replace(/\s+/g, " ");
const skill = show("SKILL.md");
const pass = flat(between(skill, "## What counts as a pass", "\n## "));
const contains = flat(between(skill, "## What a verify skill contains", "\n## "));
const run = flat(between(skill, "1. **Run.**", "2. **Record.**"));
const runDone = run.slice(run.indexOf("Complete when"));
const record = flat(between(skill, "2. **Record.**", "3. **Write.**"));
const write = flat(between(skill, "3. **Write.**", "4. **Replay.**"));
const replay = flat(between(skill, "4. **Replay.**", "## Check"));
const map = "references/feature-map-example/";
const readme = show(`${map}README.md`);
const mapPass = flat(between(readme, "## What counts as a pass", "\n## "));
const create = show(`${map}create-note.md`);
const search = show(`${map}search.md`);
const proof = (text) => flat(text.split("\n").find((l) => l.startsWith("- **Proof.**")) ?? "");
const h2s = (text) => [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].replace(/ with .+$/, " with <harness>")).join(" | ");
const shape = "Sub-features | How to get to it (user POV) | Driving it with <harness> | Gotchas";

const checks = [
  ["1 SKILL.md has a `What counts as a pass` section", pass.length > 0],
  ["1 doctor fails against a stopped and a stale instance", /stopped/.test(pass) && /stale/.test(pass) && /[Dd]octor/.test(pass)],
  ["1 each final assertion runs once where its effect is absent, and fails", /final assertion/.test(pass) && /effect is absent/.test(pass) && /base revision/.test(pass) && /feature off/.test(pass) && /before the state is reached/.test(pass)],
  ["1 the feature file records how", /feature file records how/.test(pass)],
  ["1 zero tests, any skip or any retry is not a pass", /[Zz]ero tests/.test(pass) && /skip/.test(pass) && /retry/.test(pass) && /not a pass/.test(pass)],
  ["1 a drive that flaked once runs twice with retries off", /flaked once/.test(pass) && /twice/.test(pass) && /retries off/.test(pass)],
  ["1 a measurement shows something was measured", /measurement/.test(pass) && /non-zero sample count/.test(pass)],
  ["1 one unmocked recipe per feature; mocked ones UI-only with mocks listed", /unmocked recipe/.test(pass) && /UI-only/.test(pass) && /mocks/.test(pass)],
  ["1 a capture is checked for the requested state before it is kept", /capture/.test(pass) && /requested state/.test(pass)],
  ["1 the index carries the section", /index/.test(pass) && /`What counts as a pass`/.test(flat(between(skill, "`features/README.md` is the index", "\n\n")))],
  ["1 the feature shape's drive section ends with how its proof was seen failing", /seen failing/.test(flat(between(skill, "3. `Driving it with", "\n")))],
  ["1 Drive's zero-tests line moved into the section", !/all tests skipped proves nothing/.test(contains)],
  ["1 example README has the section", mapPass.length > 0],
  ["1 example: doctor seen failing stopped and stale", /doctor/.test(mapPass) && /stopped/.test(mapPass) && /(stale|earlier build|another build)/.test(mapPass)],
  ["1 example: each feature's proof failed where its effect was absent", /effect was absent/.test(mapPass)],
  ["1 example: zero, skipped or retried is not a pass; flaked runs twice", /zero/.test(mapPass) && /skip/.test(mapPass) && /retr/.test(mapPass) && /twice/.test(mapPass)],
  ["1 example: a measurement reports its sample count", /sample count/.test(mapPass)],
  ["1 example: unmocked recipe, UI-only with mocks listed", /unmocked/.test(mapPass) && /UI-only/.test(mapPass)],
  ["1 example: open each capture and check the requested state", /capture/.test(mapPass) && /requested state/.test(mapPass)],
  ["1 example: create-note's proof says how it was seen failing", /Seen failing/.test(proof(create))],
  ["1 example: search's proof says how it was seen failing", /Seen failing/.test(proof(search))],
  ["1 example: search has a mocked recipe labelled UI-only with its mocks", /\(UI-only\)/.test(search) && /Mocks?:/.test(search)],
  ["1 example: both feature files keep the four H2s", h2s(create) === shape && h2s(search) === shape],
  ["2 Run sees doctor fail against a stopped and a stale instance", /doctor/.test(run) && /stopped/.test(run) && /stale/.test(run)],
  ["2 Run runs each final assertion where its effect is absent", /final assertion/.test(run) && /effect is absent/.test(run)],
  ["2 Run's completion requires the record to show both", /doctor failing/.test(runDone) && /stopped/.test(runDone) && /stale/.test(runDone) && /final assertion failing/.test(runDone)],
  ["2 Record: a run meant to see a check fail worked only when it failed", /see a check fail/.test(record)],
  ["2 Write puts the section and each feature's seen-failing line in the skill", /`What counts as a pass`/.test(write) && /seen failing/.test(write)],
  ["2 Replay judges results by the section", /`What counts as a pass`/.test(replay)],
  ["r1 create sees each check fail once; a later run again only when it changes that check", /Create sees doctor and each final assertion fail once/.test(pass) && /only when it changes that check/.test(pass)],
  ["r1 a feature whose effect can't be made absent: the feature file says why", /why no run can make the effect absent/.test(pass)],
  ["r1 Run records why when no run can make an effect absent; completion allows it", /When no run can make a feature's effect absent, record why/.test(run) && /or why it can't be/.test(runDone)],
  ["r1 Write: the proof says how it was seen failing or why it can't be", /how it was seen failing or why it can't be/.test(write)],
  ["r1 Run spells the order: stop the instance and run doctor, then a stale one", /stop the instance and run doctor, run doctor again against a stale instance/.test(run)],
  ["r1 example: create-note's seen-failing line covers both titles", /Seen failing:.*Release checklist.*CLI note/.test(proof(create))],
  ["r1 example: the README says when to see a check fail again", /again after changing `control-notes doctor`/.test(mapPass) && /fail again after changing it/.test(mapPass)],
  ["kept: only a gap earns another replay; third replay you start", /Only a gap earns another replay/.test(replay) && /third replay you start/.test(replay)],
];
let missing = 0;
for (const [name, ok] of checks) {
  if (!ok) missing++;
  console.log(`${ok ? "ok  " : "MISS"} ${name}`);
}
console.log(`${rev}: ${missing} of ${checks.length} missing`);
process.exitCode = missing ? 1 : 0;
```
