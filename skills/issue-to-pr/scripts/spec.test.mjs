import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC = fileURLToPath(new URL("./spec.mjs", import.meta.url));

// Answers the REST calls spec.mjs makes, from the issues in github.json beside this folder.
const FAKE_GH = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const issues = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "github.json"), "utf8"));
const [command, endpoint] = process.argv.slice(2);
const match = command === "api" && endpoint.match(/^repos\\/o\\/r\\/issues\\/(\\d+)(\\/sub_issues|\\/dependencies\\/blocked_by)?(?:\\?per_page=100)?$/);
if (!match || !issues[match[1]]) {
  console.error("unexpected gh call: " + process.argv.slice(2).join(" "));
  process.exit(1);
}
const issue = (n) => ({
  number: Number(n),
  title: issues[n].title,
  state: issues[n].state || "open",
  html_url: "https://github.com/o/r/issues/" + n,
  repository_url: "https://api.github.com/repos/" + (issues[n].repo || "o/r"),
});
const [, number, relation] = match;
const body = !relation ? issue(number)
  : relation === "/sub_issues" ? (issues[number].tickets || []).map(issue)
  : (issues[number].blockedBy || []).map(issue);
console.log(JSON.stringify(body));
`;

// A repo's run-record folder, as ~/.agent/issue-to-pr/<repo>/ holds it, with the spec's record and
// a fake `gh` on PATH that serves the GitHub state the test sets.
function specRun(t, issues) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-spec-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const records = join(dir, "records");
  mkdirSync(records);
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), FAKE_GH, { mode: 0o755 });
  const github = (state) => writeFileSync(join(dir, "github.json"), JSON.stringify(state));
  github(issues);
  const run = (args, input) => spawnSync(process.execPath, [SPEC, ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}` },
  });
  const ok = (args, input) => {
    const result = run(args, input);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };

  const spec = join(records, "10.md");
  writeFileSync(spec, [
    "issue: https://github.com/o/r/issues/10",
    "repo: o/r",
    "spec_mode: stack",
    "mode: standalone",
    "base_ref: refs/remotes/origin/main",
    "stage: contract",
    "",
  ].join("\n"));
  const pin = () => writeFileSync(spec, `${ok(["tickets", spec])}`, { flag: "a" });
  // A ticket's own run record, as its build thread writes it.
  const ticket = (n, { stage, branch = `feat/${n}-work`, pr, predecessor } = {}) => writeFileSync(join(records, `${n}.md`), [
    `issue: https://github.com/o/r/issues/${n}`,
    `mode: ${predecessor ? "stacked" : "standalone"}`,
    ...(predecessor ? [`predecessor_pr: https://github.com/o/r/pull/${predecessor}`] : []),
    `branch: ${branch}`,
    `stage: ${stage}`,
    `pr: ${pr ? `https://github.com/o/r/pull/${pr}` : "none"}`,
    "",
  ].join("\n"));
  const next = () => ok(["next", spec]).trimEnd().split("\n");
  return { spec, github, run, ok, pin, ticket, next };
}

test("a spec's unblocked tickets start at once, and one blocked by another starts when that PR is published, stacked on its branch", (t) => {
  const { spec, ok, pin, ticket, next } = specRun(t, {
    10: { title: "Scores", tickets: [3, 1, 2, 4] },
    1: { title: "Show the score" },
    2: { title: "Show a dash for no score", blockedBy: [9] },
    3: { title: "Share the score", blockedBy: [1] },
    4: { title: "Drop the old score bar", state: "closed" },
    9: { title: "Pick a font", state: "closed" },
  });
  assert.equal(ok(["tickets", spec]), [
    "Tickets:",
    "1. #1 Show the score",
    "2. #2 Show a dash for no score",
    "3. #3 Share the score",
    "   blocked by: #1",
    "",
  ].join("\n"));
  pin();

  assert.deepEqual(next(), ["#1 starts on main", "#2 starts on main", "#3 waits for #1, which has no PR yet", "running"]);

  ok(["started", spec, "1", "thread-1"]);
  ok(["started", spec, "2", "thread-2"]);
  assert.deepEqual(next(), ["#1 building", "#2 building", "#3 waits for #1, which has no PR yet", "running"]);

  ticket(1, { stage: "published", branch: "feat/1-score", pr: 21 });
  assert.deepEqual(next(), [
    "#1 published: https://github.com/o/r/pull/21",
    "#2 building",
    "#3 starts on feat/1-score, stacked on https://github.com/o/r/pull/21",
    "running",
  ]);
});

test("a ticket starts on the default branch once its blocker merges, and with two open blockers on the one whose branch holds the other", (t) => {
  const issues = {
    10: { title: "Scores", tickets: [1, 2, 3, 4, 5, 6, 7] },
    1: { title: "Show the score" },
    2: { title: "Store the score" },
    3: { title: "Sync the score", blockedBy: [2] },
    4: { title: "Theme the score" },
    5: { title: "Share the score", blockedBy: [1] },
    6: { title: "Score history", blockedBy: [2, 3] },
    7: { title: "Score colours", blockedBy: [2, 4] },
  };
  const { github, pin, ticket, next } = specRun(t, issues);
  pin();
  ticket(1, { stage: "ready", pr: 21 });
  ticket(2, { stage: "ready", pr: 22 });
  ticket(3, { stage: "watching", pr: 23, predecessor: 22 });
  ticket(4, { stage: "ready", pr: 24 });
  github({ ...issues, 1: { ...issues[1], state: "closed" } });

  assert.deepEqual(next(), [
    "#1 merged: https://github.com/o/r/pull/21",
    "#2 ready: https://github.com/o/r/pull/22",
    "#3 watching: https://github.com/o/r/pull/23",
    "#4 ready: https://github.com/o/r/pull/24",
    "#5 starts on main",
    "#6 starts on feat/3-work, stacked on https://github.com/o/r/pull/23",
    "#7 waits for #2 or #4 to merge, because they are in different stacks",
    "running",
  ]);
});

test("a ticket that ends blocked holds back only the tickets stacked above it, and the spec is done once the rest wait on you", (t) => {
  const { ok, spec, pin, ticket, next } = specRun(t, {
    10: { title: "Scores", tickets: [1, 2, 3, 4, 5] },
    1: { title: "Show the score" },
    2: { title: "Store the score" },
    3: { title: "Share the score", blockedBy: [1] },
    4: { title: "Sync the score", blockedBy: [2] },
    5: { title: "Score history", blockedBy: [3] },
  });
  pin();
  ticket(1, { stage: "blocked: repair budget", pr: 21 });
  ticket(2, { stage: "published", pr: 22 });
  assert.deepEqual(next(), [
    "#1 blocked (repair budget): https://github.com/o/r/pull/21",
    "#2 published: https://github.com/o/r/pull/22",
    "#3 waits for #1, which is blocked",
    "#4 starts on feat/2-work, stacked on https://github.com/o/r/pull/22",
    "#5 waits for #3, which has no PR yet",
    "running",
  ]);

  ok(["started", spec, "4", "thread-4"]);
  ticket(2, { stage: "ready", pr: 22 });
  ticket(4, { stage: "awaiting-human", pr: 24, predecessor: 22 });
  assert.deepEqual(next().slice(-3), ["#4 awaiting-human: https://github.com/o/r/pull/24", "#5 waits for #3, which has no PR yet", "done"]);
});

test("a one-PR body closes every ticket with its own keyword and gives each ticket its evidence", (t) => {
  const { spec, run, ok, pin } = specRun(t, {
    10: { title: "Scores", tickets: [1, 2, 3] },
    1: { title: "Show the score" },
    2: { title: "Show a dash for no score" },
    3: { title: "Share the score", blockedBy: [1] },
  });
  pin();
  const body = ({ closes = "Closes #1. Closes #2. Closes #3.", evidence = [1, 2, 3] } = {}) => [
    "## Summary",
    "",
    `The results screen shows the score, or a dash, and the score can be shared. ${closes}`,
    "",
    "## Evidence",
    "",
    ...evidence.flatMap((n) => [`**#${n}**`, "", `- **its criterion** **After:** https://github.com/o/r/blob/evidence/10/${n}.png?raw=true`, ""]),
    "## Merge danger",
    "",
    "**Door:** two-way",
    "",
  ].join("\n");
  const refused = (text, problem) => {
    const result = run(["body", spec], text);
    assert.equal(result.status, 1, `expected a refusal, got: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, problem);
  };
  refused(body({ closes: "Closes #1, #2, #3." }), /#2 never closes[\s\S]*#3 never closes/);
  refused(body({ evidence: [1, 2] }), /#3 has no evidence/);
  refused(body().replace("## Evidence", "## Proof"), /#1 has no evidence/);
  assert.match(ok(["body", spec], body()), /covers every ticket/);
});
