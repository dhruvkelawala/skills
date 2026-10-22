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
// "query" for the gate's PR read, "thread" for post's read of a thread's newest comment, "mutation"
// for resolving a thread, and "<METHOD> <endpoint>" for REST. A list answers its nth call with its
// nth entry, and then keeps giving the last. An answer `{ fail: "<message>" }` fails the call the
// way gh reports an error.
function stubGh(t, answers) {
  const dir = mkdtempSync(join(tmpdir(), "pr-watch-held-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "answers.json"), JSON.stringify(answers));
  writeFileSync(join(dir, "calls.log"), "");
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const keyOf = (call) => {
  const endpoint = call.find((a) => a === "graphql" || a.startsWith("repos/")).split("?")[0];
  const method = call.includes("-X") ? call[call.indexOf("-X") + 1] : "GET";
  if (endpoint !== "graphql") return method + " " + endpoint;
  if (call.some((a) => a.includes("mutation"))) return "mutation";
  return call.some((a) => a.includes("PullRequestReviewThread")) ? "thread" : "query";
};
const log = path.join(__dirname, "calls.log");
const key = keyOf(args);
const earlier = fs.readFileSync(log, "utf8").split("\\n").filter(Boolean).filter((line) => keyOf(JSON.parse(line)) === key).length;
fs.appendFileSync(log, JSON.stringify(args) + "\\n");
const answers = JSON.parse(fs.readFileSync(path.join(__dirname, "answers.json"), "utf8"));
const answer = Array.isArray(answers[key]) ? answers[key][Math.min(earlier, answers[key].length - 1)] : answers[key];
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
      headRefOid: HEAD, author: { login: "pr-author" },
      commits: { nodes: [{ commit: { oid: HEAD, committedDate: "2026-10-22T10:00:00Z", statusCheckRollup: null } }] },
      reviewThreads: page(threads), reviews: page([]), comments: page([]), reactions: page([]),
    } } } },
    [`GET repos/o/r/commits/${HEAD}/check-runs`]: { total_count: 1, check_runs: [{ name: "ci", status: "completed", conclusion: "success" }] },
    [`GET repos/o/r/commits/${HEAD}/status`]: { total_count: 0, statuses: [] },
  };
}

const personThread = {
  id: "PRRT_p", isResolved: false, isOutdated: false, path: "src/join.ts", line: 40,
  opening: { nodes: [{ databaseId: 201, author: { __typename: "User", login: "teammate" }, body: "Rename this to joinAll" }] },
  last: { nodes: [{ databaseId: 201 }] },
  comments: { nodes: [{ author: { __typename: "User", login: "teammate" } }], pageInfo: { hasNextPage: false } },
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
const newest = (databaseId, login) => ({ data: { node: { comments: { nodes: [{ databaseId, author: { login } }] } } } });
const SENDS = {
  thread: [newest(201, "teammate"), newest(301, "pr-author")],
  "POST repos/o/r/pulls/7/comments/201/replies": { id: 301, html_url: REPLY_URL },
  mutation: { data: { resolveReviewThread: { thread: { isResolved: true } } } },
  "POST repos/o/r/issues/7/comments": { id: 401, html_url: COMMENT_URL },
};

function holdEach(gh, held) {
  const holds = [
    ["--thread", "PRRT_p", "--reply-to", "201", "--seen", "201", "--to", "teammate", "--body-file", gh.file("reply.md", "Renamed to joinAll in 1a2b3c4.")],
    ["--review", "PRR_h", "--to", "reviewer", "--body-file", gh.file("answer.md", "1. Fixed in 1a2b3c4.\n2. Kept, because the order is fixed.")],
  ];
  for (const flags of holds) {
    const hold = gh.run(HELD, ["hold", "--file", held, ...flags]);
    assert.equal(hold.status, 0, hold.stderr);
  }
}

// What each write sent: its method, endpoint, and the -f fields after it, with the GraphQL query cut
// to its first word. Reads carry no -X and are left out.
function writes(gh) {
  return gh.calls().filter((args) => args.includes("-X")).map((args) => {
    const endpoint = args.find((a) => a === "graphql" || a.startsWith("repos/"));
    const fields = args.filter((_, i) => args[i - 1] === "-f").map((f) => (f.startsWith("query=") ? f.split(/[\s(]/)[0] : f));
    return [args[args.indexOf("-X") + 1], endpoint, ...fields];
  });
}

const recordLines = (record) => readFileSync(record, "utf8").split("\n").filter((l) => l.startsWith("- "));
const post = (gh, held, record) => gh.run(HELD, ["post", "--file", held, "--repo", "o/r", "--pr", "7", "--record", record]);

test("post sends every held reply, resolution and comment in order, and the run record lists them", (t) => {
  const gh = stubGh(t, SENDS);
  const held = gh.file("held.json");
  const record = gh.file("run-record.md", "stage: watching\n");
  holdEach(gh, held);

  const first = post(gh, held, record);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(writes(gh), [
    ["POST", "repos/o/r/pulls/7/comments/201/replies", "body=Renamed to joinAll in 1a2b3c4."],
    ["POST", "graphql", "query=mutation", "id=PRRT_p"],
    ["POST", "repos/o/r/issues/7/comments", "body=1. Fixed in 1a2b3c4.\n2. Kept, because the order is fixed."],
  ]);
  const lines = readFileSync(record, "utf8").split("\n");
  assert.equal(lines[0], "stage: watching", "post appends and keeps what the record held");
  assert.ok(lines.some((l) => /^sent on "post" at \d{4}-\d\d-\d\dT/.test(l)), lines.join("\n"));
  assert.deepEqual(recordLines(record), [
    `- reply to teammate: ${REPLY_URL}`,
    `- resolved teammate's thread: ${REPLY_URL}`,
    `- comment to reviewer: ${COMMENT_URL}`,
  ]);

  const again = post(gh, held, record);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(writes(gh).length, 3, "a second post has nothing left to send");
});

test("post stops at a failed send, the gate still waits on post, and a later post sends only what is left", (t) => {
  const answered = {
    ...personThread,
    last: { nodes: [{ databaseId: 301 }] },
    comments: { nodes: [...personThread.comments.nodes, { author: { __typename: "User", login: "pr-author" } }], pageInfo: { hasNextPage: false } },
  };
  const gh = stubGh(t, { ...openPr([answered]), ...SENDS, mutation: { fail: "API rate limit already exceeded for user ID 1." } });
  const held = gh.file("held.json");
  const record = gh.file("run-record.md", "");
  holdEach(gh, held);

  const first = post(gh, held, record);
  assert.equal(first.status, 2);
  assert.match(first.stderr, /rate limit/);
  assert.deepEqual(writes(gh).map((w) => w[1]), ["repos/o/r/pulls/7/comments/201/replies", "graphql"]);
  assert.deepEqual(recordLines(record), [`- reply to teammate: ${REPLY_URL}`]);

  const gate = gh.run(GATE, [...GATE_ARGS, "--held-file", held]);
  assert.equal(gate.status, 1, gate.stderr);
  assert.deepEqual(gate.json, { state: "pending", reasons: ['2 item(s) to people held until "post"'], threads: [] },
    "the thread whose resolve is still held is not a repair");

  gh.answer("mutation", SENDS.mutation);
  const second = post(gh, held, record);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(writes(gh).slice(2).map((w) => w[1]), ["graphql", "repos/o/r/issues/7/comments"],
    "the reply already sent is not sent twice");
});

test("post sends nothing to a thread where the person commented after the draft, and keeps it held", (t) => {
  const gh = stubGh(t, { ...SENDS, thread: newest(202, "teammate") });
  const held = gh.file("held.json");
  const record = gh.file("run-record.md", "");
  holdEach(gh, held);

  for (const attempt of [post(gh, held, record), post(gh, held, record)]) {
    assert.equal(attempt.status, 2);
    assert.match(attempt.stderr, /teammate commented in thread PRRT_p after/);
  }
  assert.deepEqual(writes(gh), []);
  assert.deepEqual(recordLines(record), []);
});
