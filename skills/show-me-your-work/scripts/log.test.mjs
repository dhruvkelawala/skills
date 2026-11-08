import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./log.sh", import.meta.url));
const header = "ts\tphase\tdecision\twhy\tevidence\tresult\n";

function log(t) {
  const folder = mkdtempSync(join(tmpdir(), "decision-log-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, "run", "decisions.tsv");
  const append = (...cells) => spawnSync("bash", [script, path, ...cells], { encoding: "utf8" });
  return { folder, path, append };
}

test("the CLI creates a nested log and appends decisions without rewriting history", (t) => {
  const { path, append } = log(t);
  assert.equal(append("frame", "Keep one skill", "Shared machinery", "brief.md:12", "open").status, 0);
  const first = readFileSync(path, "utf8");
  assert.ok(first.startsWith(header));
  assert.equal(append("check", "Keep the result", "Verified output", "checks.txt:4", "passed").status, 0);
  const text = readFileSync(path, "utf8");
  assert.ok(text.startsWith(first));
  const rows = text.trimEnd().split("\n").map((line) => line.split("\t"));
  assert.equal(rows.length, 3);
  for (const row of rows.slice(1)) {
    assert.equal(row.length, 6);
    assert.match(row[0], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.ok(Number.isFinite(Date.parse(row[0])));
  }
  assert.deepEqual(rows[1].slice(1), ["frame", "Keep one skill", "Shared machinery", "brief.md:12", "open"]);
  assert.deepEqual(rows[2].slice(1), ["check", "Keep the result", "Verified output", "checks.txt:4", "passed"]);
});

test("TSV cells stay on one line and formulas are quoted even after leading whitespace", (t) => {
  const { path, append } = log(t);
  const result = append("=1+1", " +SUM(A1)", "\t-1\nreason\r", "@link", "plain\tvalue\nnext");
  assert.equal(result.status, 0, result.stderr);
  const lines = readFileSync(path, "utf8").trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1].split("\t").slice(1), ["'=1+1", "' +SUM(A1)", "' -1 reason ", "'@link", "plain value next"]);
});

test("invalid calls and an unrelated existing file fail without changing it", (t) => {
  const { folder, path, append } = log(t);
  assert.notEqual(append("only one cell").status, 0);
  assert.equal(append("frame", "Start", "Requested", "brief.md", "open").status, 0);
  const first = readFileSync(path, "utf8");
  assert.notEqual(append("frame", "too", "many", "cells", "here", "extra").status, 0);
  assert.equal(readFileSync(path, "utf8"), first);
  const other = join(folder, "other.tsv");
  writeFileSync(other, "unrelated\tdata\nkeep\tthis\n");
  const result = spawnSync("bash", [script, other, "frame", "Start", "Requested", "brief.md", "open"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(other, "utf8"), "unrelated\tdata\nkeep\tthis\n");
});
