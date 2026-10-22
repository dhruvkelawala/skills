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
  const answer = (key, value) => {
    writeFileSync(join(dir, "answers.json"), JSON.stringify({ ...answers, [key]: value }));
  };
  return { run, calls, file, answer };
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

// --- post ---------------------------------------------------------------------

const REPLY_URL = "https://github.com/o/r/pull/7#discussion_r301";
const COMMENT_URL = "https://github.com/o/r/pull/7#issuecomment-401";
const SENDS = {
  "POST repos/o/r/pulls/7/comments/201/replies": { id: 301, html_url: REPLY_URL },
  mutation: { data: { resolveReviewThread: { thread: { isResolved: true } } } },
  "POST repos/o/r/issues/7/comments": { id: 401, html_url: COMMENT_URL },
  "POST repos/o/r/pulls/7/requested_reviewers": { number: 7 },
};

function holdEach(gh, held) {
  const holds = [
    ["--thread", "PRRT_p", "--reply-to", "201", "--seen", "201", "--to", "teammate", "--body-file", gh.file("reply.md", "Renamed to joinAll in 1a2b3c4.")],
    ["--review", "PRR_h", "--to", "reviewer", "--body-file", gh.file("answer.md", "1. Fixed in 1a2b3c4.\n2. Kept, because the order is fixed.")],
    ["--rerequest", "reviewer"],
  ];
  for (const flags of holds) {
    const hold = gh.run(HELD, ["hold", "--file", held, ...flags]);
    assert.equal(hold.status, 0, hold.stderr);
  }
}

// What a call sends: its method, endpoint, and the -f fields after it, with the GraphQL query cut to its first word.
function sent(args) {
  const method = args.includes("-X") ? args[args.indexOf("-X") + 1] : "GET";
  const endpoint = args.find((a) => a === "graphql" || a.startsWith("repos/"));
  const fields = args.filter((_, i) => args[i - 1] === "-f").map((f) => (f.startsWith("query=") ? f.split(/[\s(]/)[0] : f));
  return [method, endpoint, ...fields];
}

test("post sends every held reply, resolution, comment and re-request in order, and the run record lists them", (t) => {
  const gh = stubGh(t, SENDS);
  const held = gh.file("held.json");
  const record = gh.file("run-record.md", "stage: watching\n");
  holdEach(gh, held);

  const post = gh.run(HELD, ["post", "--file", held, "--repo", "o/r", "--pr", "7", "--record", record]);
  assert.equal(post.status, 0, post.stderr);
  assert.deepEqual(gh.calls().map(sent), [
    ["POST", "repos/o/r/pulls/7/comments/201/replies", "body=Renamed to joinAll in 1a2b3c4."],
    ["POST", "graphql", "query=mutation", "id=PRRT_p"],
    ["POST", "repos/o/r/issues/7/comments", "body=1. Fixed in 1a2b3c4.\n2. Kept, because the order is fixed."],
    ["POST", "repos/o/r/pulls/7/requested_reviewers", "reviewers[]=reviewer"],
  ]);
  const lines = readFileSync(record, "utf8").split("\n");
  assert.equal(lines[0], "stage: watching", "post appends and keeps what the record held");
  assert.ok(lines.some((l) => /^sent on "post" at \d{4}-\d\d-\d\dT/.test(l)), lines.join("\n"));
  assert.deepEqual(lines.filter((l) => l.startsWith("- ")), [
    `- reply to teammate: ${REPLY_URL}`,
    "- resolved teammate's thread PRRT_p",
    `- comment to reviewer: ${COMMENT_URL}`,
    "- review re-requested from reviewer",
  ]);

  const again = gh.run(HELD, ["post", "--file", held, "--repo", "o/r", "--pr", "7", "--record", record]);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(gh.calls().length, 4, "a second post has nothing left to send");
});

test("post stops at a failed send, keeps the rest held, and a later post sends only what is left", (t) => {
  const gh = stubGh(t, { ...SENDS, mutation: { fail: "API rate limit already exceeded for user ID 1." } });
  const held = gh.file("held.json");
  const record = gh.file("run-record.md", "");
  holdEach(gh, held);

  const first = gh.run(HELD, ["post", "--file", held, "--repo", "o/r", "--pr", "7", "--record", record]);
  assert.equal(first.status, 2);
  assert.match(first.stderr, /rate limit/);
  assert.deepEqual(gh.calls().map((c) => sent(c)[1]), ["repos/o/r/pulls/7/comments/201/replies", "graphql"]);
  assert.deepEqual(readFileSync(record, "utf8").split("\n").filter((l) => l.startsWith("- ")), [`- reply to teammate: ${REPLY_URL}`]);

  gh.answer("mutation", SENDS.mutation);
  const second = gh.run(HELD, ["post", "--file", held, "--repo", "o/r", "--pr", "7", "--record", record]);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(gh.calls().slice(2).map((c) => sent(c)[1]), [
    "graphql", "repos/o/r/issues/7/comments", "repos/o/r/pulls/7/requested_reviewers",
  ], "the reply already sent is not sent twice");
});
