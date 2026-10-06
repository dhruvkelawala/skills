import test from "node:test";
import assert from "node:assert/strict";

import { identify, parseArgs, pickNewSession, projectSessions, sessionIds } from "./find-session.mjs";

const REPO = "/work/app";
const listing = (sessions) => ({ sessions });
const s = (sessionId, pid, repoRoot = REPO, extra = {}) => ({ sessionId, pid, repoRoot, title: "t", fileCount: 3, ...extra });

test("sessionIds flattens to strings", () => {
  assert.deepEqual(sessionIds(listing([s("a", 1), s(2, 2)])), ["a", "2"]);
  assert.deepEqual(sessionIds({}), []);
});

test("projectSessions filters by repo and bounds rows", () => {
  const many = Array.from({ length: 60 }, (_, i) => s(`id${i}`, i));
  const rows = projectSessions(listing([...many, s("other", 99, "/elsewhere")]), REPO);
  assert.equal(rows.length, 50);
  assert.equal(rows[0], "id0\t/work/app\tt\t0\t3");
});

test("pickNewSession requires new-since-snapshot and pane PID", () => {
  const now = listing([s("old", 10), s("new-in-pane", 11), s("new-elsewhere", 12), s("new-other-repo", 11, "/x")]);
  assert.deepEqual(pickNewSession(now, { repoRoot: REPO, knownIds: ["old"], panePids: [11] }), ["new-in-pane"]);
});

test("identify retries until one session appears", async () => {
  let calls = 0;
  const runners = {
    sessions: async () => (++calls < 3 ? listing([s("old", 10)]) : listing([s("old", 10), s("fresh", 42)])),
    panePids: async () => [42],
  };
  const result = await identify({ repoRoot: REPO, paneId: "p1", knownIds: ["old"], retries: 5, delayMs: 1, runners, wait: async () => {} });
  assert.deepEqual(result, { ok: true, sessionId: "fresh" });
  assert.equal(calls, 3);
});

test("identify fails closed on ambiguity and on timeout", async () => {
  const ambiguous = { sessions: async () => listing([s("a", 1), s("b", 2)]), panePids: async () => [1, 2] };
  const none = { sessions: async () => listing([s("old", 1)]), panePids: async () => [] };
  const r1 = await identify({ repoRoot: REPO, paneId: "p", knownIds: [], retries: 0, runners: ambiguous, wait: async () => {} });
  const r2 = await identify({ repoRoot: REPO, paneId: "p", knownIds: ["old"], retries: 1, runners: none, wait: async () => {} });
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /ambiguous/);
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /no new Hunk session/);
});

test("parseArgs reads the identify flags", () => {
  const a = parseArgs(["identify", "--repo", REPO, "--pane", "p9", "--before", "/tmp/x.json", "--retries", "3", "--delay-ms", "100"]);
  assert.equal(a.command, "identify");
  assert.equal(a.paneId, "p9");
  assert.equal(a.retries, 3);
  assert.equal(a.delayMs, 100);
  assert.throws(() => parseArgs(["identify", "--nope"]), /unknown argument/);
});
