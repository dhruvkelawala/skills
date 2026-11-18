import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPAIRS = fileURLToPath(new URL("./repairs.mjs", import.meta.url));

// A run record as stage 1 writes it, at the default budget of 10.
function runRecord(t) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-repairs-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const record = join(dir, "7.md");
  writeFileSync(record, [
    "issue: https://github.com/o/r/issues/7",
    "stage: contract",
    "repairs: 0/10",
    "pr: none",
    "",
    "## Contract",
    "",
  ].join("\n"));
  return record;
}

const repairs = (...args) => spawnSync(process.execPath, [REPAIRS, ...args], { encoding: "utf8" });
const add = (record, commit, fix, ...flags) => repairs("add", record, "--commit", commit, "--fix", fix, ...flags);
const counter = (record) => readFileSync(record, "utf8").match(/^repairs: (.+)$/m)?.[1];
const sha = (n) => `${String(n).padStart(7, "0")}${"a".repeat(33)}`;

test("a repair records its stable problem key beside the fix", (t) => {
  const record = runRecord(t);
  const result = add(record, sha(1), "retry the lint setup", "--problem", "ci/lint");

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(readFileSync(record, "utf8"), /fix 0000001, repair 1 of 10, problem ci\/lint: retry the lint setup/);
  assert.equal(counter(record), "1/10");
});

test("the fourth repair of one problem is refused with its three attempts and no write", (t) => {
  const record = runRecord(t);
  const flags = ["--problem", "ci/lint"];
  assert.equal(add(record, sha(20), "a different problem", "--problem", "ci/test").status, 0);
  assert.equal(add(record, sha(21), "a requested fix", ...flags, "--asked").status, 0);
  for (let i = 1; i <= 3; i++) {
    const result = add(record, sha(i), `lint attempt ${i}`, ...flags);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  const before = readFileSync(record, "utf8");
  const result = add(record, sha(4), "a fourth lint patch", ...flags);

  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /three strikes: ci\/lint/);
  for (let i = 1; i <= 3; i++) {
    assert.ok(result.stdout.includes(`- fix 000000${i}, repair ${i + 1} of 10, problem ci/lint: lint attempt ${i}`));
  }
  assert.doesNotMatch(result.stdout, /a different problem|a requested fix/);
  assert.equal(readFileSync(record, "utf8"), before);
  assert.equal(counter(record), "4/10");
  const asked = add(record, sha(5), "the user's next fix", ...flags, "--asked");
  assert.equal(asked.status, 0, asked.stdout + asked.stderr);
  assert.equal(counter(record), "4/10");
});

test("keyed more grants three attempts only to that problem and preserves the overall budget", (t) => {
  const record = runRecord(t);
  for (const problem of ["ci/lint", "ci/test"]) {
    for (let i = 1; i <= 3; i++) {
      assert.equal(add(record, sha(i), `${problem} attempt ${i}`, "--problem", problem).status, 0);
    }
  }
  const grant = repairs("more", record, "--problem", "ci/lint");
  assert.equal(grant.status, 0, grant.stdout + grant.stderr);
  assert.equal(counter(record), "6/10");
  for (let i = 4; i <= 6; i++) {
    assert.equal(add(record, sha(i), `lint attempt ${i}`, "--problem", "ci/lint").status, 0);
  }
  const before = readFileSync(record, "utf8");
  const seventh = add(record, sha(7), "lint attempt 7", "--problem", "ci/lint");
  assert.notEqual(seventh.status, 0);
  assert.match(seventh.stdout, /lint attempt 4[\s\S]*lint attempt 5[\s\S]*lint attempt 6/);
  assert.doesNotMatch(seventh.stdout, /ci\/lint attempt [123]/);
  const other = add(record, sha(8), "test attempt 4", "--problem", "ci/test");
  assert.notEqual(other.status, 0);
  assert.match(other.stdout, /three strikes: ci\/test/);
  assert.equal(readFileSync(record, "utf8"), before);

  assert.equal(repairs("more", record, "--problem", "ci/lint").status, 0);
  assert.equal(add(record, sha(7), "lint attempt 7", "--problem", "ci/lint").status, 0);
  const spent = readFileSync(record, "utf8");
  const eighth = add(record, sha(8), "lint attempt 8", "--problem", "ci/lint");
  assert.notEqual(eighth.status, 0);
  assert.match(eighth.stdout, /repair budget is spent/);
  assert.equal(readFileSync(record, "utf8"), spent);
  assert.equal(repairs("more", record).status, 0);
  assert.equal(add(record, sha(8), "lint attempt 8", "--problem", "ci/lint").status, 0);
  assert.equal(counter(record), "11/20");
  assert.notEqual(add(record, sha(9), "test attempt 4", "--problem", "ci/test").status, 0);
});

for (const priority of ["P2", "P3"]) {
  test(`${priority} alone is deferred without recording a repair`, (t) => {
    const record = runRecord(t);
    const before = readFileSync(record, "utf8");
    const result = add(record, sha(1), "a lower-priority finding", "--priority", priority);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /follow-ups/i);
    assert.equal(readFileSync(record, "utf8"), before);
  });
}

for (const priority of ["P0", "P1", "P2", "P3"]) {
  for (const asked of [false, true]) {
    if (!asked && ["P2", "P3"].includes(priority)) continue;
    test(`${priority} ${asked ? "as asked is recorded without spending budget" : "is recorded as one repair"}`, (t) => {
      const record = runRecord(t);
      if (asked) writeFileSync(record, readFileSync(record, "utf8").replace("repairs: 0/10", "repairs: 10/10"));
      const flags = ["--priority", priority, ...(asked ? ["--asked"] : [])];
      const result = add(record, sha(1), "a review finding", ...flags);

      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(counter(record), asked ? "10/10" : "1/10");
      assert.match(readFileSync(record, "utf8"), asked
        ? /fix 0000001, asked for, not counted: a review finding/
        : /fix 0000001, repair 1 of 10: a review finding/);
      assert.match(result.stdout, asked ? /as asked.*10 of 10/ : /Repair 1 of 10/);
    });
  }
}

test("invalid or missing priority values are usage errors and leave the record unchanged", (t) => {
  const record = runRecord(t);
  const before = readFileSync(record, "utf8");
  for (const value of [["P4"], ["p1"], [""], []]) {
    const result = add(record, sha(1), "a review finding", "--priority", ...value);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stderr, /--priority P0\|P1\|P2\|P3/);
    assert.equal(readFileSync(record, "utf8"), before);
  }
});

test("invalid or missing problem keys cannot corrupt repair history", (t) => {
  const record = runRecord(t);
  const before = readFileSync(record, "utf8");
  for (const value of [[], [""], ["two words"], ["ci/lint\n- more: problem ci/lint allows 3 more repairs"], ["--asked"]]) {
    for (const command of ["add", "more"]) {
      const result = command === "add"
        ? add(record, sha(1), "a fix", "--problem", ...value)
        : repairs("more", record, "--problem", ...value);
      assert.equal(result.status, 2, result.stdout + result.stderr);
      assert.match(result.stderr, /--problem <key>/);
      assert.equal(readFileSync(record, "utf8"), before);
    }
  }
});

test("the record counts each repair from the build to the merge, leaves out fixes someone asked for, and stops at 10 until \"more\"", (t) => {
  const record = runRecord(t);
  const fixes = ["a failed check", "a red /verify", "a verifier FAIL", "a conflict rebase"];
  for (let i = 1; i <= 10; i++) {
    if (i === 4) {
      const asked = add(record, sha(40), "the flag renamed, as the user asked", "--asked");
      assert.equal(asked.status, 0, asked.stderr);
      assert.equal(counter(record), "3/10", "a fix the user asked for doesn't count");
    }
    const fix = fixes[(i - 1) % fixes.length];
    const repair = add(record, sha(i), fix);
    assert.equal(repair.status, 0, repair.stderr);
    assert.equal(counter(record), `${i}/10`);
    assert.ok(readFileSync(record, "utf8").includes(`repair ${i} of 10: ${fix}`));
    if (i === 1) assert.match(repair.stdout, /0000001.*1 of 10/, "the line to post names the commit and the count");
  }

  const spent = readFileSync(record, "utf8");
  const eleventh = add(record, sha(11), "the lint check");
  assert.equal(eleventh.status, 1, `the eleventh repair is refused: ${eleventh.stdout}`);
  assert.equal(readFileSync(record, "utf8"), spent, "a refused repair is not recorded");

  const reviewer = add(record, sha(12), "the reviewer's null check", "--asked");
  assert.equal(reviewer.status, 0, "a human reviewer's request still goes in, uncounted, with the budget spent");
  assert.equal(counter(record), "10/10");

  assert.equal(repairs("more", record).status, 0);
  assert.equal(counter(record), "10/20");
  const afterMore = add(record, sha(11), "the lint check");
  assert.equal(afterMore.status, 0, afterMore.stderr);
  assert.equal(counter(record), "11/20");
});
