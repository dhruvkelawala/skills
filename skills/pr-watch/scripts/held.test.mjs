import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GATE = fileURLToPath(new URL("./pr-gate.mjs", import.meta.url));
const HELD = fileURLToPath(new URL("./held.mjs", import.meta.url));
const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// A gh on PATH that logs each call's arguments as a JSON line and answers from `answers`, keyed by
// "query" for the gate's PR read, "mutation" for resolving a thread, and "<METHOD> <endpoint>" for
// REST. An answer `{ fail: "<message>" }` fails the call the way gh reports an error.
function stubGh(t, answers) {
  const dir = mkdtempSync(join(tmpdir(), "pr-watch-held-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "answers.json"), JSON.stringify(answers));
  writeFileSync(join(dir, "calls.log"), "");
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, "calls.log"), JSON.stringify(args) + "\\n");
const answers = JSON.parse(fs.readFileSync(path.join(__dirname, "answers.json"), "utf8"));
const endpoint = args.find((a) => a === "graphql" || a.startsWith("repos/")).split("?")[0];
const method = args.includes("-X") ? args[args.indexOf("-X") + 1] : "GET";
const key = endpoint !== "graphql" ? method + " " + endpoint
  : args.some((a) => a.includes("mutation")) ? "mutation" : "query";
const answer = answers[key];
if (!answer || answer.fail) {
  process.stderr.write("gh: " + (answer ? answer.fail : "Not Found (HTTP 404)") + "\\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify(answer));
`, { mode: 0o755 });
  const run = (script, args) => {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });
    let json = null;
    try { json = JSON.parse(result.stdout); } catch {}
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
  };
  const calls = () => readFileSync(join(dir, "calls.log"), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const file = (name, text) => {
    const path = join(dir, name);
    if (text !== undefined) writeFileSync(path, text);
    return path;
  };
  return { run, calls, file };
}

function openPr(threads) {
  const page = (nodes) => ({ nodes, pageInfo: { hasNextPage: false } });
  return {
    query: { data: { repository: { pullRequest: {
      state: "OPEN", isDraft: false, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", reviewDecision: null,
      headRefOid: HEAD, author: { login: "dhruv" },
      commits: { nodes: [{ commit: { oid: HEAD, committedDate: "2026-10-22T10:00:00Z", statusCheckRollup: null } }] },
      reviewThreads: page(threads), reviews: page([]), comments: page([]), reactions: page([]),
    } } } },
    [`GET repos/o/r/commits/${HEAD}/check-runs`]: { total_count: 1, check_runs: [{ name: "ci", status: "completed", conclusion: "success" }] },
    [`GET repos/o/r/commits/${HEAD}/status`]: { total_count: 0, statuses: [] },
  };
}

const personThread = {
  id: "PRRT_p", isResolved: false, isOutdated: false, path: "src/join.ts", line: 40,
  comments: { nodes: [{ databaseId: 201, author: { __typename: "User", login: "teammate" }, body: "Rename this to joinAll" }] },
  latest: { nodes: [{ databaseId: 201, author: { __typename: "User", login: "teammate" } }] },
};
const GATE_ARGS = ["--repo", "o/r", "--pr", "7", "--expected-head", HEAD, "--json"];

test("a person's thread: hold keeps the drafted reply off GitHub, and the gate then waits on post", (t) => {
  const gh = stubGh(t, openPr([personThread]));
  const held = gh.file("held.json");

  const before = gh.run(GATE, GATE_ARGS);
  assert.equal(before.status, 2, before.stderr);
  const [thread] = before.json.threads;
  assert.deepEqual(
    { id: thread.id, replyTo: thread.replyTo, lastCommentId: thread.lastCommentId, author: thread.author, bot: thread.bot },
    { id: "PRRT_p", replyTo: 201, lastCommentId: 201, author: "teammate", bot: false },
  );

  const reads = gh.calls().length;
  for (const draft of ["first draft", "Renamed to joinAll in 1a2b3c4."]) {
    const hold = gh.run(HELD, [
      "hold", "--file", held, "--thread", thread.id, "--reply-to", String(thread.replyTo),
      "--seen", String(thread.lastCommentId), "--to", thread.author, "--body-file", gh.file("reply.md", draft),
    ]);
    assert.equal(hold.status, 0, hold.stderr);
  }
  assert.equal(gh.calls().length, reads, "holding a reply makes no GitHub call");

  const after = gh.run(GATE, [...GATE_ARGS, "--held-file", held]);
  assert.equal(after.status, 1, after.stderr);
  assert.deepEqual(after.json, { state: "pending", reasons: ['1 item(s) to people held until "post"'], threads: [] });
});
