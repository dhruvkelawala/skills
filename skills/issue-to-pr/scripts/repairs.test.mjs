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

test("the record counts each repair from the build to the merge, leaves out fixes someone asked for, and stops at 10 until \"more\"", (t) => {
  const record = runRecord(t);
  // Three repairs in the build's review passes, then seven from the watch, with the user's own ask
  // in between.
  for (let i = 1; i <= 10; i++) {
    if (i === 4) {
      const asked = add(record, sha(40), "the flag renamed, as the user asked", "--asked");
      assert.equal(asked.status, 0, asked.stderr);
      assert.equal(counter(record), "3/10", "a fix the user asked for doesn't count");
    }
    const repair = add(record, sha(i), `review finding ${i}`);
    assert.equal(repair.status, 0, repair.stderr);
    assert.equal(counter(record), `${i}/10`);
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
